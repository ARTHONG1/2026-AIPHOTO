import * as THREE from 'three';
import QRCode from 'qrcode';

/** Decorative intro only. The persistent, scannable QR is an independent <img>. */
export function startQrPortalIntro(canvas: HTMLCanvasElement, url: string, ready: () => void, finish: () => void) {
  let renderer: THREE.WebGLRenderer | undefined;
  let frame = 0;
  let stopped = false;
  const scene = new THREE.Scene();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const instances: THREE.InstancedMesh[] = [];
  const dispose = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    canvas.removeEventListener('webglcontextlost', lost);
    instances.forEach(mesh => mesh.dispose());
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    renderer?.dispose();
  };
  const lost = (event: Event) => { event.preventDefault(); dispose(); finish(); };
  try {
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!context) { finish(); return dispose; }
    renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const size = Math.max(1, Math.round(canvas.clientWidth));
    renderer.setSize(size, size, false);
    canvas.addEventListener('webglcontextlost', lost);
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    const extent = (n + 8) / 0.76;
    const camera = new THREE.OrthographicCamera(-extent / 2, extent / 2, extent / 2, -extent / 2, 0.1, 500);
    camera.position.set(0, 0, 150);
    const group = new THREE.Group();
    scene.add(group, new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.DirectionalLight(0x8beeff, 3);
    light.position.set(-30, 40, 80);
    scene.add(light);
    const plateGeometry = new THREE.BoxGeometry(n + 8, n + 8, 0.6);
    const plateMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    geometries.push(plateGeometry);
    materials.push(plateMaterial);
    const plate = new THREE.Mesh(plateGeometry, plateMaterial);
    plate.position.z = -0.5;
    group.add(plate);
    const targets: { x: number; y: number; phase: number }[] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (qr.modules.get(y, x)) targets.push({ x: x - (n - 1) / 2, y: (n - 1) / 2 - y, phase: ((x * 17 + y * 31) % 101) / 101 });
    }
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x35cddd, metalness: 0.35, roughness: 0.28 });
    geometries.push(geometry);
    materials.push(material);
    const blocks = new THREE.InstancedMesh(geometry, material, targets.length);
    instances.push(blocks);
    blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Animated positions exceed the final QR bounds.
    blocks.frustumCulled = false;
    group.add(blocks);
    const dummy = new THREE.Object3D();
    const start = performance.now();
    let announced = false;
    const tick = () => {
      if (stopped) return;
      try {
        const t = Math.min(1, (performance.now() - start) / 1500);
        const ease = 1 - Math.pow(1 - t, 3);
        const scatter = 1 - ease;
        group.rotation.set(scatter * 0.55, scatter * -0.3, scatter * -0.08);
        material.color.setRGB(0.025 + scatter * 0.18, 0.04 + scatter * 0.76, 0.07 + scatter * 0.78);
        targets.forEach((target, i) => {
          const angle = target.phase * Math.PI * 2;
          dummy.position.set(target.x + Math.cos(angle) * scatter * n * 0.28, target.y + Math.sin(angle) * scatter * n * 0.28, 0.5 + scatter * (8 + target.phase * 16));
          dummy.rotation.set(scatter * angle, scatter * angle * 0.7, scatter * angle * 0.4);
          dummy.scale.setScalar(0.92 + ease * 0.08);
          dummy.updateMatrix();
          blocks.setMatrixAt(i, dummy.matrix);
        });
        blocks.instanceMatrix.needsUpdate = true;
        renderer!.render(scene, camera);
        if (!announced) { announced = true; ready(); }
        if (t >= 1) { dispose(); finish(); return; }
        frame = requestAnimationFrame(tick);
      } catch { dispose(); finish(); }
    };
    tick();
    return dispose;
  } catch (error) { dispose(); throw error; }
}
