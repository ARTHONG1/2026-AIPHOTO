// Lobby 3D scene (three.js / WebGL2): a spiral galaxy of GPU-animated particles,
// a baked nebula sky, hyperspace streaks and bloom. No model files are loaded.
// Performance: particles animate in shaders (one draw call each), the nebula is
// rendered once into a texture, pixel ratio drops automatically on slow devices,
// and the loop pauses while the tab is hidden.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type LobbySceneHandle = {
  /** Plays the hyperspace jump and resolves when it ends. */
  warp: (durationMs?: number) => Promise<void>;
  dispose: () => void;
};

type Options = { onReady?: () => void };

const CARD_IDS = [
  'space-galaxy',
  'dna-lab',
  'volcano',
  'coral-reef',
  'mars-base',
  'tesla-lightning',
  'aurora',
  'jurassic',
  'robot-factory',
  'crystal-cave',
];
const CARD_EDGES = ['#5de4ff', '#ffd24d', '#ff7ad9'];

const FOV = 45;
const MAX_DPR = 1.25;
const MIN_DPR = 0.6;
const GALAXY_RADIUS = 7.5;
const CARD_RADIUS = 9.4;
const BLOOM_STRENGTH = 0.75;

// ---------- shaders ----------
const NOISE = `
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return v;
}
`;

const QUAD_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Equirectangular nebula sky, rendered once at startup.
const NEBULA_FRAG =
  NOISE +
  `
varying vec2 vUv;
void main() {
  float phi = vUv.x * 6.2831853;
  float theta = (1.0 - vUv.y) * 3.1415926;
  vec3 dir = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
  float band = exp(-pow((dir.y + 0.2 * sin(phi * 2.0 + 1.0)) * 3.0, 2.0));
  float n1 = fbm(dir * 2.2);
  float n2 = fbm(dir * 4.5 + 5.3);
  float n3 = fbm(dir * 3.1 + 11.7);
  vec3 col = vec3(0.004, 0.006, 0.02);
  col += vec3(0.32, 0.07, 0.58) * pow(n1, 2.6) * 1.6;
  col += vec3(0.02, 0.45, 0.66) * pow(n2, 3.0) * 2.0 * (0.25 + band);
  col += vec3(0.85, 0.14, 0.46) * pow(n3, 4.0) * 2.6 * band;
  col *= 0.3 + band * 0.9;
  col *= 1.0 - 0.65 * band * smoothstep(0.52, 0.72, fbm(dir * 6.0 + 2.0));
  gl_FragColor = vec4(col, 1.0);
}`;

// Spiral galaxy: arms turn rigidly while the bulge swirls faster.
const GALAXY_VERT = `
attribute vec3 aParams; // radius, angle, height
attribute vec3 aColor;
attribute float aSize;
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;
varying vec3 vColor;
void main() {
  float r = aParams.x;
  // Differential rotation: the core spins fast, the arms follow slower.
  float a = aParams.y + uTime * 0.22 + uTime * 0.9 * (1.0 - smoothstep(0.0, 2.5, r));
  vec3 p = vec3(cos(a) * r, aParams.z, sin(a) * r);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uSize * uPixelRatio / -mv.z;
  vColor = aColor;
}`;

const SOFT_POINT_FRAG = `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 18.0);
  gl_FragColor = vec4(vColor, a);
}`;

const STAR_VERT = `
attribute float aSeed;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
uniform float uScale;
varying vec3 vColor;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (1.4 + aSeed * aSeed * aSeed * 3.2) * uPixelRatio * uScale;
  float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 2.5) + aSeed * 80.0);
  vColor = aColor * twinkle * (0.25 + aSeed * 0.6);
}`;

// Hyperspace streaks live in camera space and fly toward the viewer.
const STREAK_VERT = `
attribute vec3 aSeed; // x, y, start z
attribute float aEnd; // 0 = head, 1 = tail
uniform float uTravel;
uniform float uWarp;
varying float vAlpha;
void main() {
  float z = mod(aSeed.z + uTravel, 120.0) - 122.0;
  float len = 0.4 + uWarp * 42.0;
  vec3 p = vec3(aSeed.xy, z - aEnd * len);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  float fade = smoothstep(-122.0, -70.0, z) * smoothstep(-2.0, -10.0, z);
  vAlpha = fade * (1.0 - aEnd) * mix(0.05, 1.0, uWarp);
}`;

const STREAK_FRAG = `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uColor * 1.6, vAlpha);
}`;

const UV_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Photo card: rounded corners, glowing edge, dimmed when far from the camera.
// Expanding shock ring in the galaxy plane (uProgress 0..1 per pulse).
const PULSE_FRAG = `
uniform float uProgress;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float ring = exp(-pow((r - uProgress) * 70.0, 2.0));
  float a = ring * (1.0 - uProgress) * smoothstep(0.0, 0.08, uProgress) * 0.55;
  gl_FragColor = vec4(uColor * 1.4, a);
}`;

// Shooting stars: short bright heads with long fading tails.
const METEOR_FRAG = `
uniform float uLife;
varying vec2 vUv;
void main() {
  float tail = smoothstep(0.0, 1.0, vUv.x);
  float core = exp(-pow((vUv.y - 0.5) * 7.0, 2.0));
  float fade = sin(uLife * 3.14159);
  gl_FragColor = vec4(vec3(0.8, 0.95, 1.0) * 2.2, tail * tail * core * fade);
}`;

const CARD_FRAG = `
uniform sampler2D uMap;
uniform vec3 uEdge;
uniform float uDim;
varying vec2 vUv;
float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 p = (vUv - 0.5) * vec2(0.8, 1.0);
  float d = roundBox(p, vec2(0.4, 0.5), 0.05);
  float aa = fwidth(d);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  float edge = smoothstep(-0.028, -0.012, d);
  vec3 col = texture2D(uMap, vUv).rgb;
  col = mix(col * 1.1, uEdge * 2.2, edge);
  gl_FragColor = vec4(col * uDim, inside);
  #include <colorspace_fragment>
}`;

const PLANET_VERT = `
varying vec3 vNormal;
varying vec3 vObj;
void main() {
  vObj = normalize(position);
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Gas giant: swirling bands lit by the galaxy core.
const PLANET_FRAG =
  NOISE +
  `
uniform vec3 uLight;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vObj;
void main() {
  float swirl = noise(vObj * 5.0 + vec3(uTime * 0.03, 0.0, 0.0));
  float b1 = 0.5 + 0.5 * sin(vObj.y * 24.0 + swirl * 3.0);
  float b2 = 0.5 + 0.5 * sin(vObj.y * 9.0 - swirl * 2.0 + 1.3);
  vec3 col = mix(vec3(0.2, 0.1, 0.5), vec3(1.0, 0.55, 0.78), b1 * 0.6);
  col = mix(col, vec3(0.35, 0.8, 1.0), b2 * 0.35);
  float diff = smoothstep(-0.3, 0.7, dot(normalize(vNormal), uLight));
  gl_FragColor = vec4(col * (0.015 + diff * 0.55), 1.0);
  #include <colorspace_fragment>
}`;

const FRESNEL_VERT = `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRESNEL_FRAG = `
uniform vec3 uColor;
uniform float uPower;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float f = pow(1.0 - max(dot(vNormal, vView), 0.0), uPower);
  gl_FragColor = vec4(uColor * f * 0.9, f);
  #include <colorspace_fragment>
}`;

const RING_VERT = `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const RING_FRAG = `
uniform vec3 uColor;
uniform vec2 uRange;
varying vec2 vPos;
void main() {
  float r = length(vPos);
  float bands = 0.5 + 0.5 * sin(r * 11.0);
  float a = smoothstep(uRange.x, uRange.x + 0.3, r) * smoothstep(uRange.y, uRange.y - 0.5, r) * (0.1 + 0.3 * bands);
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

// ---------- helpers ----------
const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;

function gauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

function glowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function glowSprite(map: THREE.Texture, color: string, scale: number, opacity = 1) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, opacity, ...additive }));
  sprite.scale.setScalar(scale);
  return sprite;
}

function bakeNebula(renderer: THREE.WebGLRenderer) {
  const target = new THREE.WebGLRenderTarget(1600, 800, { depthBuffer: false });
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: NEBULA_FRAG, depthTest: false })
  );
  scene.add(quad);
  renderer.setRenderTarget(target);
  renderer.render(scene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
  renderer.setRenderTarget(null);
  quad.geometry.dispose();
  (quad.material as THREE.Material).dispose();
  return target;
}

function makeGalaxy(count: number, uniforms: Record<string, THREE.IUniform>) {
  const params = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const inner = new THREE.Color('#ffe4b8');
  const mid = new THREE.Color('#ff5fc8');
  const outer = new THREE.Color('#3f7bff');
  const hot = new THREE.Color('#7ff4ff');
  const c = new THREE.Color();
  const branches = 4;
  for (let i = 0; i < count; i++) {
    const bulge = Math.random() < 0.16;
    let r: number;
    let angle: number;
    let h: number;
    if (bulge) {
      r = Math.pow(Math.random(), 2) * 1.8;
      angle = Math.random() * Math.PI * 2;
      h = gauss() * 0.32 * (1 - r / 2);
    } else {
      r = 0.5 + Math.pow(Math.random(), 1.3) * (GALAXY_RADIUS - 0.5);
      const branch = ((i % branches) / branches) * Math.PI * 2;
      const spread = Math.pow(Math.random(), 2.4) * (Math.random() < 0.5 ? -1 : 1) * 0.6;
      angle = branch + r * 0.9 + spread;
      r *= 1 + gauss() * 0.05;
      h = gauss() * 0.1 * (1.3 - r / GALAXY_RADIUS);
    }
    const t = r / GALAXY_RADIUS;
    c.copy(inner)
      .lerp(mid, THREE.MathUtils.smoothstep(t, 0.08, 0.5))
      .lerp(outer, THREE.MathUtils.smoothstep(t, 0.45, 1));
    if (Math.random() < 0.04) c.copy(hot);
    // Dim individual particles; dense arms and the bulge add up and cross the bloom threshold.
    c.multiplyScalar(bulge ? 0.4 : 0.42);
    params[i * 3] = r;
    params[i * 3 + 1] = angle;
    params[i * 3 + 2] = h;
    c.toArray(color, i * 3);
    size[i] = (bulge ? 1.2 : 1) * (0.6 + Math.pow(Math.random(), 6) * 3.4);
  }
  const geometry = new THREE.BufferGeometry();
  // Positions are computed in the shader; this attribute only sets the vertex count.
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aParams', new THREE.BufferAttribute(params, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), GALAXY_RADIUS * 1.2);
  const material = new THREE.ShaderMaterial({ vertexShader: GALAXY_VERT, fragmentShader: SOFT_POINT_FRAG, uniforms, ...additive });
  return new THREE.Points(geometry, material);
}

function makeStars(count: number, uniforms: Record<string, THREE.IUniform>) {
  const position = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const palette = ['#ffffff', '#ffffff', '#a8ecff', '#ffe38a', '#cdb8ff'].map((c) => new THREE.Color(c));
  const dir = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    dir.randomDirection().multiplyScalar(160 + Math.random() * 260);
    dir.toArray(position, i * 3);
    palette[Math.floor(Math.random() * palette.length)].toArray(color, i * 3);
    seed[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const material = new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: SOFT_POINT_FRAG, uniforms, ...additive });
  return new THREE.Points(geometry, material);
}

function makeStreaks(count: number, uniforms: Record<string, THREE.IUniform>) {
  const seed = new Float32Array(count * 6);
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.pow(Math.random(), 0.7) * 60;
    const z = Math.random() * 120;
    for (let k = 0; k < 2; k++) {
      seed.set([Math.cos(a) * r, Math.sin(a) * r, z], (i * 2 + k) * 3);
      end[i * 2 + k] = k;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  geometry.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const material = new THREE.ShaderMaterial({ vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, uniforms, ...additive });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  return lines;
}

function makePlanet(time: THREE.IUniform) {
  const group = new THREE.Group();
  const light = { value: new THREE.Vector3() };
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 64, 40),
    new THREE.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, uniforms: { uLight: light, uTime: time } })
  );
  const air = new THREE.Mesh(
    new THREE.SphereGeometry(2.95, 64, 40),
    new THREE.ShaderMaterial({
      vertexShader: FRESNEL_VERT,
      fragmentShader: FRESNEL_FRAG,
      uniforms: { uColor: { value: new THREE.Color('#8fd8ff') }, uPower: { value: 2.6 } },
      ...additive,
    })
  );
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 5.6, 128, 1),
    new THREE.ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      uniforms: { uColor: { value: new THREE.Color('#ffd9a0') }, uRange: { value: new THREE.Vector2(3.4, 5.6) } },
      side: THREE.DoubleSide,
      ...additive,
    })
  );
  ring.rotation.set(1.25, 0.25, 0.35);
  group.add(body, air, ring);
  return { group, body, light };
}

// ---------- scene ----------
export function createLobbyScene(host: HTMLElement, { onReady }: Options = {}): LobbySceneHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  } catch (error) {
    console.warn('[lobby] WebGL unavailable', error);
    return null;
  }
  // The lobby is an attract screen, so it always animates. Many kiosk PCs have Windows
  // animations turned off (which reports reduced motion), so that setting only calms it down.
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = calm ? 0.5 : 1;
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || Math.min(screen.width, screen.height) < 700;
  let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor('#03040b');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  host.appendChild(renderer.domElement);

  let disposed = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1500);
  scene.add(camera);

  const time = { value: 0 };
  const pixelRatio = { value: dpr };
  const pointScale = { value: 1 };
  const glow = glowTexture();
  const textures: THREE.Texture[] = [glow];

  // Sky: nebula baked once, plus twinkling stars.
  const nebula = bakeNebula(renderer);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 64, 32),
    new THREE.MeshBasicMaterial({ map: nebula.texture, side: THREE.BackSide, depthWrite: false })
  );
  sky.rotation.set(0.35, 0, 0.2);
  scene.add(sky);
  const stars = makeStars(lowEnd ? 1400 : 2400, { uTime: time, uPixelRatio: pixelRatio, uScale: pointScale });
  scene.add(stars);

  // Galaxy with a hot glowing core.
  const galaxyUniforms = { uTime: time, uPixelRatio: pixelRatio, uSize: { value: 34 } };
  const galaxy = makeGalaxy(lowEnd ? 28000 : 60000, galaxyUniforms);
  galaxy.rotation.z = 0.08;
  scene.add(galaxy);
  const coreGlow = glowSprite(glow, '#ffd9a8', 2.6, 0.75);
  const coreHalo = glowSprite(glow, '#9b6bff', 13, 0.12);
  scene.add(coreGlow, coreHalo);

  const planet = makePlanet(time);
  planet.group.position.set(-15, 3, -19);
  planet.light.value.copy(planet.group.position).negate().normalize();
  scene.add(planet.group);

  const streakUniforms = { uTravel: { value: 0 }, uWarp: { value: 0.04 }, uColor: { value: new THREE.Color('#bfe9ff') } };
  camera.add(makeStreaks(lowEnd ? 700 : 1400, streakUniforms));

  // Shock rings rippling out of the core every few seconds.
  const pulses = [0, 0.5].map((offset) => {
    const material = new THREE.ShaderMaterial({
      vertexShader: UV_VERT,
      fragmentShader: PULSE_FRAG,
      uniforms: { uProgress: { value: offset }, uColor: { value: new THREE.Color(offset ? '#ff7ad9' : '#5de4ff') } },
      side: THREE.DoubleSide,
      ...additive,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(GALAXY_RADIUS * 2.6, GALAXY_RADIUS * 2.6), material);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    return { material, offset };
  });

  // Shooting stars that streak across the sky at random.
  const meteorGeometry = new THREE.PlaneGeometry(1, 1);
  const meteors = Array.from({ length: 4 }, () => {
    const material = new THREE.ShaderMaterial({ vertexShader: UV_VERT, fragmentShader: METEOR_FRAG, uniforms: { uLife: { value: 0 } }, ...additive });
    const mesh = new THREE.Mesh(meteorGeometry, material);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, material, start: new THREE.Vector3(), dir: new THREE.Vector3(), born: -99, life: 1 };
  });
  let nextMeteor = 1.2;

  // Electrons circling the galaxy core on tilted orbits.
  const electrons = ['#5de4ff', '#ffd24d', '#ff7ad9'].map((color, i) => {
    const pivot = new THREE.Group();
    pivot.rotation.set(1.1 + i * 0.35, i * 1.2, i * 0.7);
    const dot = glowSprite(glow, color, 1.4);
    dot.add(glowSprite(glow, '#ffffff', 0.35));
    pivot.add(dot);
    scene.add(pivot);
    return { dot, radius: 3.2 + i * 0.9, speed: 1.3 - i * 0.25, phase: i * 2.1 };
  });

  // Photo cards: the real AI backgrounds orbiting in the galaxy plane.
  const cardGeometry = new THREE.PlaneGeometry(1.52, 1.9);
  const loader = new THREE.TextureLoader();
  const cards = CARD_IDS.map((id, i) => {
    const material = new THREE.ShaderMaterial({
      vertexShader: UV_VERT,
      fragmentShader: CARD_FRAG,
      uniforms: {
        uMap: { value: null as THREE.Texture | null },
        uEdge: { value: new THREE.Color(CARD_EDGES[i % CARD_EDGES.length]) },
        uDim: { value: 1 },
      },
      transparent: true,
    });
    const mesh = new THREE.Mesh(cardGeometry, material);
    mesh.visible = false;
    loader.load('/presets/backgrounds/' + id + '.webp', (texture) => {
      if (disposed) return texture.dispose();
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      textures.push(texture);
      material.uniforms.uMap.value = texture;
      mesh.visible = true;
    });
    scene.add(mesh);
    return mesh;
  });

  // Science Himchan floating through space like an astronaut.
  const himchan = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#d8d8d8', transparent: true, depthWrite: false }));
  himchan.scale.set(2.3, 2.96, 1);
  himchan.visible = false;
  loader.load('/brand/himchan-science.webp', (texture) => {
    if (disposed) return texture.dispose();
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    himchan.material.map = texture;
    himchan.material.needsUpdate = true;
    himchan.visible = true;
  });
  scene.add(himchan);

  // Post-processing: bloom makes every bright particle glow.
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM_STRENGTH, 0.45, 0.62);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- layout ----------
  let width = 1;
  let height = 1;
  let distance = 20;
  let lookY = 0;
  function layout() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const landscape = camera.aspect >= 1;
    // Fit the galaxy plus card ring across the width; portrait screens crop the edges.
    distance = THREE.MathUtils.clamp((landscape ? 10.5 : 7.5) / (halfTan * camera.aspect), 15, 34);
    // Negative values lift the galaxy above the title block at the bottom.
    lookY = landscape ? -2.6 : -3.2;
    pointScale.value = height / 900;
    galaxyUniforms.uSize.value = 34 * (height / 900);
  }

  // ---------- animation ----------
  const pointer = new THREE.Vector2();
  const target = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let raf = 0;
  let last = 0;
  let readySent = false;
  let warpStart = 0;
  let warpDuration = 1100;
  let warpResolve: (() => void) | null = null;
  let sampleSum = 0;
  let sampleCount = 0;
  let warmup = 60;
  let introDone = false;

  function cameraTarget(t: number, e: number) {
    // Full orbit around the galaxy every ~50s, rising and dipping through the disk.
    const swing = t * 0.12;
    const elev = 0.5 + Math.sin(t * 0.21) * 0.28;
    const d = distance * (0.92 + Math.sin(t * 0.17) * 0.12) * (1 - e * 0.72);
    target.set(Math.sin(swing) * Math.cos(elev) * d, Math.sin(elev) * d, Math.cos(swing) * Math.cos(elev) * d);
    target.x += pointer.x * 1.4 * (1 - e);
    target.y += pointer.y * 0.9 * (1 - e);
    return target;
  }

  function update(t: number, e: number, dt: number) {
    cameraTarget(t, e);
    if (!introDone) {
      // Start far away so the first seconds are a dolly into the galaxy.
      camera.position.set(target.x * 0.2, target.y * 2.4, target.z * 3.2);
      introDone = true;
    }
    if (dt === 0) camera.position.copy(target);
    else camera.position.lerp(target, 1 - Math.exp(-dt * (1.1 + e * 30)));
    camera.lookAt(0, lookY * (1 - e), 0);
    const fov = FOV + e * 55;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const pulse = 1 + Math.sin(t * 2.4) * 0.14;
    coreGlow.scale.setScalar(2.6 * pulse * (1 + e * 1.5));
    coreHalo.material.rotation = t * 0.05;
    bloom.strength = BLOOM_STRENGTH + e * 0.8;
    streakUniforms.uWarp.value = 0.04 + e;

    planet.body.rotation.y = t * 0.2;
    planet.group.position.y = 3 + Math.sin(t * 0.4) * 0.8;

    const camDist = camera.position.length();
    cards.forEach((card, i) => {
      // Counter-orbit against the camera so cards visibly sweep past.
      const a = -t * 0.22 + (i / cards.length) * Math.PI * 2;
      const r = CARD_RADIUS + Math.sin(t * 0.5 + i) * 0.8;
      card.position.set(Math.cos(a) * r, 0.4 + Math.sin(t * 1.1 + i * 1.7) * 1.1, Math.sin(a) * r);
      card.quaternion.copy(camera.quaternion);
      card.rotateZ(Math.sin(t * 0.9 + i) * 0.12);
      const near = THREE.MathUtils.clamp((camDist + CARD_RADIUS - card.position.distanceTo(camera.position)) / (2 * CARD_RADIUS), 0, 1);
      card.scale.setScalar(0.8 + near * 0.35);
      (card.material as THREE.ShaderMaterial).uniforms.uDim.value = 0.3 + near * 0.7;
    });

    const ha = t * 0.1 + 2.2;
    himchan.position.set(Math.cos(ha) * 11.5, 2.4 + Math.sin(t * 0.7) * 0.5, Math.sin(ha) * 11.5);
    himchan.material.rotation = Math.sin(t * 0.8) * 0.14;
    tmp.copy(himchan.position);

    for (const pulse of pulses) pulse.material.uniforms.uProgress.value = (t * 0.28 + pulse.offset) % 1;

    for (const orbit of electrons) {
      const a = t * orbit.speed + orbit.phase;
      orbit.dot.position.set(Math.cos(a) * orbit.radius, Math.sin(a) * orbit.radius, 0);
    }

    if (t > nextMeteor) {
      const m = meteors.find((x) => t - x.born > x.life);
      if (m) {
        m.born = t;
        m.life = 0.9 + Math.random() * 0.6;
        // Spawn in front of the camera, then fly diagonally across the view.
        m.start.set((Math.random() - 0.5) * 30, 6 + Math.random() * 8, (Math.random() - 0.5) * 30);
        m.dir.set(-0.8 - Math.random() * 0.6, -0.35 - Math.random() * 0.3, (Math.random() - 0.5) * 0.6).normalize();
      }
      nextMeteor = t + 0.8 + Math.random() * 1.6;
    }
    for (const m of meteors) {
      const age = (t - m.born) / m.life;
      m.mesh.visible = age >= 0 && age <= 1;
      if (!m.mesh.visible) continue;
      m.material.uniforms.uLife.value = age;
      m.mesh.position.copy(m.start).addScaledVector(m.dir, age * 22);
      m.mesh.quaternion.copy(camera.quaternion);
      // Align the streak with its travel direction on screen.
      tmp.copy(m.dir).applyQuaternion(camera.quaternion.clone().invert());
      m.mesh.rotateZ(Math.atan2(tmp.y, tmp.x) + Math.PI);
      m.mesh.scale.set(7, 0.18, 1);
    }
  }

  function renderOnce() {
    if (disposed) return;
    update(time.value, 0, 0);
    composer.render();
  }

  function adaptQuality(frameMs: number) {
    if (warmup > 0) {
      warmup--;
      return;
    }
    sampleSum += frameMs;
    sampleCount++;
    if (sampleCount < 90) return;
    const avg = sampleSum / sampleCount;
    sampleSum = 0;
    sampleCount = 0;
    if (avg > 22 && dpr > MIN_DPR) {
      dpr = Math.max(MIN_DPR, dpr - 0.2);
      renderer.setPixelRatio(dpr);
      composer.setPixelRatio(dpr);
      layout();
      pixelRatio.value = dpr;
      warmup = 30;
    }
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const frameMs = last ? now - last : 16;
    last = now;
    adaptQuality(frameMs);
    let warp = 0;
    if (warpStart) {
      warp = Math.min((now - warpStart) / warpDuration, 1);
      if (warp >= 1 && warpResolve) {
        warpResolve();
        warpResolve = null;
      }
    }
    const e = warp * warp;
    const dt = Math.min(frameMs / 1000, 0.05);
    time.value += dt * (motion + e * 5);
    streakUniforms.uTravel.value += dt * (7 + e * 240);
    update(time.value, e, dt);
    composer.render(dt);
    if (!readySent) {
      readySent = true;
      onReady?.();
    }
  }

  function start() {
    if (disposed || raf || document.hidden) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  const onPointer = (e: PointerEvent) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  };
  const onVisibility = () => (document.hidden ? stop() : start());
  const onContextLost = (e: Event) => {
    e.preventDefault();
    stop();
  };
  const resize = new ResizeObserver(layout);

  resize.observe(host);
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  layout();
  start();

  return {
    warp(durationMs = 1100) {
      if (disposed || !raf) return Promise.resolve();
      warpDuration = durationMs;
      warpStart = performance.now();
      return new Promise<void>((resolve) => {
        warpResolve = resolve;
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      warpResolve?.();
      resize.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
      textures.forEach((t) => t.dispose());
      nebula.dispose();
      bloom.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
