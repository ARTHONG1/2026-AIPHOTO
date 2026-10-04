import * as THREE from 'three';
import QRCode from 'qrcode';

export type PortalMode = '3d' | 'flat';
export type PortalScene = { setMode: (mode: PortalMode, reduced: boolean) => void; dispose: () => void };

/** Persistent raised sculpture; the independent QR image handles scanning. */
export function createQrPortalScene(canvas: HTMLCanvasElement, url: string, options: {
  mode: PortalMode; reduced: boolean; settled: (mode: PortalMode) => void; failed: () => void;
}): PortalScene {
  let renderer: THREE.WebGLRenderer | undefined;
  let frame = 0, last = 0, lastPaint = 0, elapsed = 0;
  let disposed = false, visible = true, announced = false;
  let reduced = options.reduced;
  let morph = options.mode === 'flat' ? 1 : 0;
  let target = morph;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  let blocks: THREE.InstancedMesh | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let intersectionObserver: IntersectionObserver | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame);
    resizeObserver?.disconnect(); intersectionObserver?.disconnect();
    document.removeEventListener('visibilitychange', visibilityChanged);
    canvas.removeEventListener('webglcontextlost', lost);
    blocks?.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    renderer?.dispose();
    if (renderer && !renderer.getContext().isContextLost()) renderer.forceContextLoss();
  };
  const lost = (event: Event) => { event.preventDefault(); dispose(); options.failed(); };
  const visibilityChanged = () => { cancelAnimationFrame(frame); frame = 0; last = 0; schedule(); };
  let paint: () => void;
  const schedule = () => {
    if (!disposed && !frame && visible && !document.hidden && (morph !== target || (!reduced && target === 0))) frame = requestAnimationFrame(tick);
  };
  const tick = (now: number) => {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    if (now - lastPaint < 1000 / 30) { schedule(); return; }
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now; lastPaint = now; elapsed += dt;
    if (morph !== target) {
      morph = reduced ? target : target > morph ? Math.min(target, morph + dt / 0.85) : Math.max(target, morph - dt / 0.85);
    }
    try {
      paint();
      if (morph === target && !announced) { announced = true; options.settled(target === 1 ? 'flat' : '3d'); }
      schedule();
    } catch { dispose(); options.failed(); }
  };
  try {
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!context) throw new Error('WebGL2 unavailable');
    renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    canvas.addEventListener('webglcontextlost', lost);
    const scene = new THREE.Scene();
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size, extent = (n + 8) / 0.74;
    const camera = new THREE.OrthographicCamera(-extent / 2, extent / 2, extent / 2, -extent / 2, 0.1, 500);
    camera.position.set(0, 0, 150);
    const group = new THREE.Group();
    scene.add(group, new THREE.AmbientLight(0xffffff, 1.8));
    const light = new THREE.DirectionalLight(0xb6f6ff, 3.5);
    light.position.set(-40, 50, 90); scene.add(light);
    const rimLight = new THREE.DirectionalLight(0x9b87ff, 2);
    rimLight.position.set(45, -20, 30); scene.add(rimLight);
    const plateGeometry = new THREE.BoxGeometry(n + 8, n + 8, 2);
    const plateMaterial = new THREE.MeshStandardMaterial({ color: 0xe8f6ff, metalness: 0.15, roughness: 0.35 });
    geometries.push(plateGeometry); materials.push(plateMaterial);
    const plate = new THREE.Mesh(plateGeometry, plateMaterial);
    plate.position.z = -1.05; group.add(plate);
    const targets: { x: number; y: number; height: number }[] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (qr.modules.get(y, x)) targets.push({ x: x - (n - 1) / 2, y: (n - 1) / 2 - y, height: 2.4 + ((x * 17 + y * 31) % 7) * 0.5 });
    }
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x087b9d, metalness: 0.55, roughness: 0.25 });
    geometries.push(geometry); materials.push(material);
    blocks = new THREE.InstancedMesh(geometry, material, targets.length);
    blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    blocks.frustumCulled = false; group.add(blocks);
    const dummy = new THREE.Object3D();
    let paintedMorph = NaN;
    paint = () => {
      const depth = 1 - morph * morph * (3 - 2 * morph);
      const sway = reduced ? 0 : Math.sin(elapsed * 0.65) * 0.025;
      group.rotation.set(depth * (0.58 + sway), depth * (-0.38 + sway), depth * -0.08);
      group.position.y = depth * -1;
      if (morph !== paintedMorph) {
        material.color.setRGB(0.025, 0.035 + depth * 0.27, 0.055 + depth * 0.37);
        targets.forEach((cell, i) => {
          const height = 0.5 + depth * cell.height;
          dummy.position.set(cell.x, cell.y, height / 2);
          dummy.scale.set(1, 1, height); dummy.updateMatrix(); blocks!.setMatrixAt(i, dummy.matrix);
        });
        blocks!.instanceMatrix.needsUpdate = true;
        paintedMorph = morph;
      }
      renderer!.render(scene, camera);
    };
    const resize = () => {
      if (disposed) return;
      try { const size = Math.max(1, Math.round(canvas.clientWidth)); renderer!.setSize(size, size, false); paint(); }
      catch { dispose(); options.failed(); }
    };
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
    intersectionObserver = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting; cancelAnimationFrame(frame); frame = 0; last = 0; schedule();
    });
    intersectionObserver.observe(canvas);
    document.addEventListener('visibilitychange', visibilityChanged);
    resize();
    if (disposed) throw new Error('QR renderer failed');
    announced = true; options.settled(options.mode); schedule();
    return {
      setMode(mode, reduce) {
        if (disposed) return;
        reduced = reduce; target = mode === 'flat' ? 1 : 0; announced = false; last = 0;
        cancelAnimationFrame(frame); frame = 0;
        if (reduced || morph === target) {
          morph = target;
          try { paint(); announced = true; options.settled(mode); } catch { dispose(); options.failed(); }
        }
        schedule();
      }, dispose,
    };
  } catch (error) { dispose(); throw error; }
}
