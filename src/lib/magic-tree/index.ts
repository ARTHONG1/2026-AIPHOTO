/*!
 * Adapted from Magic Tree (https://github.com/Slifronic/magic-tree).
 * MIT License, Copyright (c) 2026 Magic Tree contributors. See ./LICENSE.
 *
 * Photo booth changes: the scene lives in a square result panel without the
 * original control dock, pauses while hidden, stops drawing once the code is
 * still, and reports settle/failure so the flat QR image can take over.
 */
import * as THREE from 'three';
import type { QRCodeErrorCorrectionLevel } from 'qrcode';
import { buildQr, type QrMatrix } from './qr';
import { buildPlot, type PlotMeshes } from './plot';
import { buildCanopy, type Canopy } from './canopy';
import { buildMotes, type Motes } from './motes';
import { CELL, HEDGE_RING, ISO_AZIMUTH, ISO_ELEVATION, TOP_ELEVATION } from './constants';
import { clamp01, lerp, easeInOutCubic } from './rng';
import { SEASONS, type Palette } from './palette';
import { SPECIES, type Species } from './species';

export type ViewMode = 'tree' | 'code';

export interface MagicTreeOptions {
  mode: ViewMode;
  errorCorrectionLevel?: QRCodeErrorCorrectionLevel;
  palette?: Palette;
  species?: Species;
  /** Called whenever the morph comes to rest, including the first frame. */
  onSettled?: (mode: ViewMode) => void;
  /** Called after WebGL fails mid-run; the scene has already released itself. */
  onFailed?: () => void;
}

/** Seconds for a full canopy <-> code transition. */
const MORPH_SECONDS = 0.95;

export class MagicTreeScene {
  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  private key = new THREE.DirectionalLight(0xfff6e6, 1.15);
  private ambient = new THREE.AmbientLight(0xffffff, 0.62);
  private hemi = new THREE.HemisphereLight(0xffffff, 0xd8cfbe, 0.5);

  private plot?: PlotMeshes;
  private canopy?: Canopy;
  private motes?: Motes;
  private qr?: QrMatrix;
  private world = new THREE.Group();
  private target = new THREE.Vector3();
  private offset = new THREE.Vector3();

  private palette: Palette;
  private species: Species;
  private level: QRCodeErrorCorrectionLevel;
  private morph: number;
  private morphTarget: number;
  private lastTime = 0;
  private elapsed = 0;
  private raf = 0;
  private frame = 0;
  private disposed = false;
  private visible = true;
  private announced: ViewMode | null = null;

  private isoHalfW = 20;
  private isoHalfV = 20;
  private isoCenter = new THREE.Vector3();
  private rimUnits = 40;

  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;

  constructor(private canvas: HTMLCanvasElement, text: string, private options: MagicTreeOptions) {
    this.palette = options.palette ?? SEASONS.summer;
    this.species = options.species ?? SPECIES.oak;
    this.level = options.errorCorrectionLevel ?? 'H';
    this.morph = this.morphTarget = options.mode === 'code' ? 1 : 0;

    const context = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!context) throw new Error('WebGL2 unavailable');
    canvas.addEventListener('webglcontextlost', this.onContextLost);

    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.scene.background = new THREE.Color(this.palette.ground);

      this.key.castShadow = true;
      this.key.shadow.mapSize.set(2048, 2048);
      this.key.shadow.bias = -0.0006;
      this.scene.add(this.ambient, this.hemi, this.key, this.key.target);

      this.scene.add(this.world);
      this.build(text);

      this.resizeObserver = new ResizeObserver(this.resize);
      this.resizeObserver.observe(canvas);
      this.intersectionObserver = new IntersectionObserver((entries) => {
        this.visible = entries.some((entry) => entry.isIntersecting);
        this.pauseOrResume();
      });
      this.intersectionObserver.observe(canvas);
      document.addEventListener('visibilitychange', this.pauseOrResume);

      this.resize();
      if (this.disposed) throw new Error('Magic Tree failed to draw');
      this.announce();
      this.schedule();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  // ---------------------------------------------------------------- build

  private build(text: string) {
    this.qr = buildQr(text, this.level);
    this.plot = buildPlot(this.qr, this.palette);
    this.canopy = buildCanopy(this.qr, this.palette, this.species);
    this.motes = buildMotes(this.qr, this.palette);
    this.world.add(this.plot.group, this.canopy.group, this.motes.points);

    const rim = (this.qr.plot + HEDGE_RING * 2) * CELL;
    this.rimUnits = rim;
    this.measureIsoFraming(rim);

    const shadowExtent = rim * 0.8;
    const cam = this.key.shadow.camera;
    cam.left = -shadowExtent;
    cam.right = shadowExtent;
    cam.top = shadowExtent;
    cam.bottom = -shadowExtent;
    cam.near = 1;
    cam.far = 400;
    cam.updateProjectionMatrix();

    this.canopy.setMorph(this.morph, 0);
  }

  /**
   * Measures the scene's screen-space extent at the isometric angle by
   * projecting the plot corners and the canopy's bounding box onto the camera's
   * own screen axes, recording the content's midpoint as well as its size.
   */
  private measureIsoFraming(rim: number) {
    const { canopyTop, canopyRadius } = this.canopy!.model;

    const dir = new THREE.Vector3(
      Math.cos(ISO_ELEVATION) * Math.sin(ISO_AZIMUTH),
      Math.sin(ISO_ELEVATION),
      Math.cos(ISO_ELEVATION) * Math.cos(ISO_AZIMUTH),
    ).normalize();
    const forward = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const half = rim / 2;
    const points: THREE.Vector3[] = [
      new THREE.Vector3(-half, 0, -half),
      new THREE.Vector3(half, 0, -half),
      new THREE.Vector3(-half, 0, half),
      new THREE.Vector3(half, 0, half),
    ];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        points.push(new THREE.Vector3(sx * canopyRadius, 0, sz * canopyRadius));
        points.push(new THREE.Vector3(sx * canopyRadius, canopyTop, sz * canopyRadius));
      }
    }

    let wMin = Infinity;
    let wMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const pt of points) {
      const w = pt.dot(right);
      const v = pt.dot(up);
      wMin = Math.min(wMin, w);
      wMax = Math.max(wMax, w);
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
    }

    this.isoHalfW = (wMax - wMin) / 2;
    this.isoHalfV = (vMax - vMin) / 2;
    this.isoCenter
      .set(0, 0, 0)
      .addScaledVector(right, (wMin + wMax) / 2)
      .addScaledVector(up, (vMin + vMax) / 2);
  }

  private teardown() {
    if (!this.plot || !this.canopy || !this.motes) return;
    this.world.remove(this.plot.group, this.canopy.group, this.motes.points);
    this.canopy.dispose();
    this.motes.dispose();
    this.plot.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | undefined;
      mat?.dispose();
    });
    this.plot = this.canopy = this.motes = undefined;
  }

  // ----------------------------------------------------------------- api

  setMode(mode: ViewMode) {
    if (this.disposed) return;
    const next = mode === 'code' ? 1 : 0;
    if (next !== this.morphTarget) {
      this.morphTarget = next;
      this.announced = null;
    }
    this.announce();
    this.schedule();
  }

  get mode(): ViewMode {
    return this.morphTarget > 0.5 ? 'code' : 'tree';
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.pauseOrResume);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    try {
      this.teardown();
    } catch {
      // Releasing GPU buffers is best effort once the context is gone.
    }
    if (this.renderer) {
      const gl = this.renderer.getContext();
      this.renderer.dispose();
      if (!gl.isContextLost()) this.renderer.forceContextLoss();
    }
  }

  // -------------------------------------------------------------- lifecycle

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.fail();
  };

  private fail() {
    if (this.disposed) return;
    this.dispose();
    this.options.onFailed?.();
  }

  private resize = () => {
    if (this.disposed || !this.renderer) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    try {
      this.renderer.setSize(w, h, false);
      this.draw(0, false);
    } catch {
      this.fail();
    }
  };

  private pauseOrResume = () => {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.lastTime = 0;
    this.schedule();
  };

  /** The settled code is perfectly still, so it is drawn once and left alone. */
  private needsFrames() {
    return this.morph !== this.morphTarget || this.morph < 0.999 || this.frame < 2;
  }

  private schedule() {
    if (this.disposed || this.raf || !this.visible || document.hidden || !this.needsFrames()) return false;
    this.raf = requestAnimationFrame(this.loop);
    return true;
  }

  private announce() {
    if (this.morph !== this.morphTarget) return;
    const mode = this.mode;
    if (this.announced === mode) return;
    this.announced = mode;
    this.options.onSettled?.(mode);
  }

  // -------------------------------------------------------------- camera

  /** Frames the crown in the iso view and the whole plot in the top-down view. */
  private updateCamera() {
    // The camera runs on an eased copy of the morph so the swing eases in and
    // out instead of starting and stopping dead.
    const t = easeInOutCubic(this.morph);
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    const aspect = w / h;

    const margin = 1.05;
    const fit = (halfW: number, halfV: number) => Math.max(halfV, halfW / aspect) * margin;
    const halfRim = this.rimUnits / 2;
    const half = lerp(fit(this.isoHalfW, this.isoHalfV), fit(halfRim, halfRim), t);

    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.near = -600;
    this.camera.far = 600;
    this.camera.updateProjectionMatrix();

    const azimuth = lerp(ISO_AZIMUTH, 0, t);
    const elevation = lerp(ISO_ELEVATION, TOP_ELEVATION, t);
    const r = 220;

    this.offset.set(
      r * Math.cos(elevation) * Math.sin(azimuth),
      r * Math.sin(elevation),
      r * Math.cos(elevation) * Math.cos(azimuth),
    );

    // Aim at the content's midpoint, easing to the plot centre for the code view.
    this.target.copy(this.isoCenter).multiplyScalar(1 - t);
    this.camera.position.copy(this.target).add(this.offset);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();

    // Flatten the lighting as the code resolves so no shadow crosses a module.
    // Blown-out light modules and near-black dark ones is exactly what a
    // scanner's binariser wants, so push the ambient hard at the end.
    this.key.intensity = lerp(1.15, 0.14, t);
    this.ambient.intensity = lerp(0.62, 2.45, t);
    this.hemi.intensity = lerp(0.5, 0.18, t);
    this.key.castShadow = t < 0.6;
    this.key.position.set(-60, 120, 70).add(this.target);
    this.key.target.position.copy(this.target);
    this.key.target.updateMatrixWorld();
  }

  // ---------------------------------------------------------------- loop

  private draw(dt: number, changed: boolean) {
    // Idle sway only matters while the canopy is up; skip work once settled.
    const idle = this.morph < 0.999;
    if (idle || changed || this.frame < 2) this.canopy!.setMorph(this.morph, this.elapsed);
    this.motes!.update(dt, this.elapsed, 1 - this.morph);
    this.updateCamera();
    this.renderer!.render(this.scene, this.camera);
  }

  private loop = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;

    const dt = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = now;
    this.elapsed += dt;

    let changed = false;
    if (this.morph !== this.morphTarget) {
      const step = dt / MORPH_SECONDS;
      this.morph = clamp01(
        this.morphTarget > this.morph
          ? Math.min(this.morph + step, this.morphTarget)
          : Math.max(this.morph - step, this.morphTarget),
      );
      changed = true;
    }

    try {
      this.draw(dt, changed);
    } catch {
      this.fail();
      return;
    }
    this.frame++;
    this.announce();
    if (!this.schedule()) this.lastTime = 0;
  };
}
