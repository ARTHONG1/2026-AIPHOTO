'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, RotateCcw, Share2, SwitchCamera, Video, X } from 'lucide-react';
import type { FaceLandmarker, ImageSegmenter, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { BACKGROUNDS } from '@/lib/presets';
import { cn } from '@/lib/utils';

// Everything runs on the visitor's phone with MediaPipe. The wasm (~23 MB, cached by the
// browser) and models (face 3.7 MB, person cut-out 0.25 MB) come from public CDNs.
const TASKS_VERSION = '1.0.1';
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + TASKS_VERSION + '/wasm';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const SEGMENT_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
const INK = '#2b2350';
const CLIP_SECONDS = 5;
// The cut-out runs on a small copy of the frame; the mask is scaled up softly.
const SEGMENT_WIDTH = 256;

type EffectId = 'portal' | 'hologram' | 'helmet' | 'einstein' | 'goggles' | 'planets' | 'bulb';
const EFFECTS: { id: EffectId; label: string; icon: string }[] = [
  { id: 'portal', label: '사진 속으로', icon: '🌌' },
  { id: 'hologram', label: '내 사진 홀로그램', icon: '🖼️' },
  { id: 'helmet', label: '우주 헬멧', icon: '🧑‍🚀' },
  { id: 'einstein', label: '아인슈타인', icon: '👨‍🔬' },
  { id: 'goggles', label: '실험 고글', icon: '🥽' },
  { id: 'planets', label: '행성 왕관', icon: '🪐' },
  { id: 'bulb', label: '아이디어 전구', icon: '💡' },
];

type MagicId = 'rocket' | 'zap' | 'stars' | 'sparkle';
const MAGIC: { id: MagicId; icon: string; label: string }[] = [
  { id: 'rocket', icon: '🚀', label: '입 크게 벌리기' },
  { id: 'zap', icon: '⚡', label: '눈 꼭 감기' },
  { id: 'stars', icon: '⭐', label: '눈썹 올리기' },
  { id: 'sparkle', icon: '✨', label: '활짝 웃기' },
];

type Pt = { x: number; y: number };
/** Face anchors in canvas pixels plus expression scores (0..1) by blendshape name. */
type Face = {
  center: Pt;
  forehead: Pt;
  nose: Pt;
  mouth: Pt;
  leftEye: Pt;
  rightEye: Pt;
  width: number;
  height: number;
  roll: number;
  blend: Record<string, number>;
};
type Status = 'starting' | 'live' | 'denied';
type Loadable = 'idle' | 'loading' | 'ready' | 'failed';
type Particle = {
  kind: 'rocket' | 'smoke' | 'star' | 'planet' | 'spark' | 'heart' | 'bolt' | 'dust';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
};
type FaceMagicState = { closedSince: number; lastZap: number; browUp: boolean; lastRocket: number; lastSparkle: number };
type Capture = { kind: 'photo'; url: string } | { kind: 'video'; url: string; mime: string };

const avg = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const BRIGHT = ['#ffd84d', '#5de4ff', '#ff7ad9', '#7dff9c', '#ffffff'];

function toFace(lm: NormalizedLandmark[], blend: Record<string, number>, w: number, h: number, mirror: boolean): Face {
  const p = (i: number): Pt => ({ x: (mirror ? 1 - lm[i].x : lm[i].x) * w, y: lm[i].y * h });
  const top = p(10);
  const chin = p(152);
  return {
    center: avg(top, chin),
    forehead: p(151),
    nose: p(1),
    mouth: avg(p(13), p(14)),
    leftEye: avg(p(33), p(133)),
    rightEye: avg(p(362), p(263)),
    width: dist(p(234), p(454)),
    height: dist(top, chin),
    // Chin-to-forehead direction gives the head roll whatever the mirroring.
    roll: Math.atan2(top.y - chin.y, top.x - chin.x) + Math.PI / 2,
    blend,
  };
}

/** Light smoothing between frames removes the jitter of raw landmarks. */
function smoothFaces(prev: Face[], next: Face[]): Face[] {
  if (prev.length !== next.length) return next;
  const k = 0.55;
  const mix = (a: Pt, b: Pt): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
  return next.map((f, i) => {
    const p = prev[i];
    if (dist(p.center, f.center) > f.width * 0.6) return f;
    let dr = f.roll - p.roll;
    if (dr > Math.PI) dr -= Math.PI * 2;
    if (dr < -Math.PI) dr += Math.PI * 2;
    return {
      ...f,
      center: mix(p.center, f.center),
      forehead: mix(p.forehead, f.forehead),
      nose: mix(p.nose, f.nose),
      mouth: mix(p.mouth, f.mouth),
      leftEye: mix(p.leftEye, f.leftEye),
      rightEye: mix(p.rightEye, f.rightEye),
      width: p.width + (f.width - p.width) * k,
      height: p.height + (f.height - p.height) * k,
      roll: p.roll + dr * k,
    };
  });
}

const upOf = (f: Face): Pt => ({ x: Math.sin(f.roll), y: -Math.cos(f.roll) });
const turn = (v: Pt, a: number): Pt => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });

/** Moves the context into face space: origin at the face centre, rotated with the head. */
function enterFace(ctx: CanvasRenderingContext2D, f: Face) {
  ctx.translate(f.center.x, f.center.y);
  ctx.rotate(f.roll);
}
function toLocal(f: Face, p: Pt): Pt {
  return turn({ x: p.x - f.center.x, y: p.y - f.center.y }, -f.roll);
}
function outline(ctx: CanvasRenderingContext2D, width: number) {
  ctx.lineWidth = width;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

// ---------- face props ----------
function drawHelmet(ctx: CanvasRenderingContext2D, f: Face, t: number) {
  const r = f.height * 0.98;
  ctx.save();
  enterFace(ctx, f);
  const cy = -f.height * 0.06;
  ctx.beginPath();
  ctx.ellipse(0, cy + r * 0.92, r * 0.72, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#dfe4f0';
  ctx.fill();
  outline(ctx, Math.max(3, r * 0.025));
  const glass = ctx.createRadialGradient(0, cy, r * 0.5, 0, cy, r);
  glass.addColorStop(0, 'rgba(170, 230, 255, 0.04)');
  glass.addColorStop(1, 'rgba(120, 200, 255, 0.32)');
  ctx.beginPath();
  ctx.arc(0, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.lineWidth = r * 0.1;
  ctx.strokeStyle = '#eef1f8';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, cy, r * 1.05, 0, Math.PI * 2);
  outline(ctx, Math.max(3, r * 0.02));
  ctx.beginPath();
  ctx.arc(0, cy, r * 0.82, Math.PI * 1.1, Math.PI * 1.38);
  ctx.lineWidth = r * 0.06;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.55, cy - r * 0.9);
  ctx.lineTo(r * 0.7, cy - r * 1.32);
  outline(ctx, Math.max(4, r * 0.035));
  ctx.beginPath();
  ctx.arc(r * 0.7, cy - r * 1.36, r * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = Math.sin(t * 6) > 0 ? '#ff5a6e' : '#ffd84d';
  ctx.fill();
  outline(ctx, Math.max(2, r * 0.02));
  ctx.restore();
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#f7f7f9';
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.strokeStyle = '#a3a9b8';
  ctx.stroke();
}

function drawEinstein(ctx: CanvasRenderingContext2D, f: Face, t: number) {
  ctx.save();
  enterFace(ctx, f);
  const rings = [
    { rx: 0.78, ry: 0.72, r: 0.24, n: 13, from: 0.78, to: 2.22 },
    { rx: 0.6, ry: 0.6, r: 0.17, n: 11, from: 0.95, to: 2.05 },
  ];
  rings.forEach((ring, k) => {
    for (let i = 0; i < ring.n; i++) {
      const a = Math.PI * (ring.from + ((ring.to - ring.from) * i) / (ring.n - 1));
      const wob = Math.sin(t * 3 + i * 1.7 + k) * f.width * 0.02;
      const r = f.width * ring.r * (0.8 + 0.35 * Math.abs(Math.sin(i * 7.3 + k * 2.1)));
      puff(ctx, Math.cos(a) * (f.width * ring.rx + wob), Math.sin(a) * (f.height * ring.ry + wob) - f.height * 0.05, r);
    }
  });
  const m = avg(toLocal(f, f.nose), toLocal(f, f.mouth));
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(m.x + side * f.width * 0.11, m.y - f.height * 0.02);
    ctx.rotate(side * 0.25);
    ctx.beginPath();
    ctx.ellipse(0, 0, f.width * 0.14, f.width * 0.065, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f7f7f9';
    ctx.fill();
    ctx.lineWidth = Math.max(2, f.width * 0.012);
    ctx.strokeStyle = '#a3a9b8';
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawGoggles(ctx: CanvasRenderingContext2D, f: Face) {
  ctx.save();
  enterFace(ctx, f);
  const l = toLocal(f, f.leftEye);
  const r = toLocal(f, f.rightEye);
  const rad = f.width * 0.19;
  const y = (l.y + r.y) / 2;
  ctx.beginPath();
  ctx.moveTo(-f.width * 0.62, y);
  ctx.lineTo(f.width * 0.62, y);
  ctx.lineWidth = rad * 0.55;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = rad * 0.38;
  ctx.strokeStyle = '#ff9b4d';
  ctx.stroke();
  for (const e of [l, r]) {
    ctx.beginPath();
    ctx.arc(e.x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(93, 228, 255, 0.32)';
    ctx.fill();
    ctx.lineWidth = rad * 0.32;
    ctx.strokeStyle = '#ffd84d';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(e.x, y, rad * 1.16, 0, Math.PI * 2);
    outline(ctx, Math.max(2, rad * 0.08));
    ctx.beginPath();
    ctx.arc(e.x - rad * 0.3, y - rad * 0.3, rad * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();
  }
  ctx.restore();
}

const PLANETS = [
  { color: '#ffb35c', size: 0.16, ring: true },
  { color: '#5de4ff', size: 0.12, ring: false },
  { color: '#ff7ad9', size: 0.1, ring: false },
  { color: '#7dff9c', size: 0.13, ring: false },
];

function drawPlanets(ctx: CanvasRenderingContext2D, f: Face, t: number) {
  ctx.save();
  enterFace(ctx, f);
  const cy = -f.height * 0.66;
  const rx = f.width * 0.95;
  const ry = f.width * 0.26;
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.setLineDash([f.width * 0.04, f.width * 0.03]);
  ctx.lineWidth = Math.max(2, f.width * 0.012);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.stroke();
  ctx.setLineDash([]);
  PLANETS.forEach((p, i) => {
    const a = t * 1.3 + (i * Math.PI) / 2;
    const x = Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    const r = f.width * p.size * (0.85 + 0.15 * Math.sin(a));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    outline(ctx, Math.max(2, r * 0.18));
    if (p.ring) {
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.8, r * 0.5, -0.3, 0, Math.PI * 2);
      ctx.lineWidth = r * 0.25;
      ctx.strokeStyle = '#ffe08a';
      ctx.stroke();
    }
  });
  ctx.restore();
}

function drawBulb(ctx: CanvasRenderingContext2D, f: Face, t: number) {
  ctx.save();
  enterFace(ctx, f);
  const r = f.width * 0.24;
  const y = -f.height * 0.5 - r * 1.9 + Math.sin(t * 2.4) * r * 0.12;
  const glow = ctx.createRadialGradient(0, y, r * 0.3, 0, y, r * 2.6);
  glow.addColorStop(0, 'rgba(255, 230, 80, ' + (0.55 + 0.25 * Math.sin(t * 5)) + ')');
  glow.addColorStop(1, 'rgba(255, 230, 80, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
  for (let i = 0; i < 8; i++) {
    const a = t * 0.8 + (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35);
    ctx.lineTo(Math.cos(a) * r * 1.8, y + Math.sin(a) * r * 1.8);
    ctx.lineWidth = r * 0.14;
    ctx.strokeStyle = '#ffd84d';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe066';
  ctx.fill();
  outline(ctx, Math.max(2, r * 0.1));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(-r * 0.45, y + r * 0.85, r * 0.9, r * 0.6, r * 0.15);
  else ctx.rect(-r * 0.45, y + r * 0.85, r * 0.9, r * 0.6);
  ctx.fillStyle = '#c9ccd9';
  ctx.fill();
  outline(ctx, Math.max(2, r * 0.1));
  ctx.restore();
}

function drawHologram(ctx: CanvasRenderingContext2D, photo: HTMLImageElement, face: Face | undefined, canvas: HTMLCanvasElement, t: number) {
  const h = face ? face.height * 1.35 : canvas.height * 0.42;
  const w = (h * photo.naturalWidth) / photo.naturalHeight;
  let x: number;
  let y: number;
  if (face) {
    x = face.center.x + face.width * 0.62 + w / 2;
    if (x + w / 2 > canvas.width) x = face.center.x - face.width * 0.62 - w / 2;
    y = face.center.y;
  } else {
    x = canvas.width - w / 2 - canvas.width * 0.05;
    y = canvas.height * 0.32;
  }
  y += Math.sin(t * 1.8) * h * 0.03;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 1.2) * 0.05);
  const beam = ctx.createLinearGradient(0, h / 2, 0, h * 0.95);
  beam.addColorStop(0, 'rgba(93, 228, 255, 0.35)');
  beam.addColorStop(1, 'rgba(93, 228, 255, 0)');
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(w * 0.08, h * 0.95);
  ctx.lineTo(-w * 0.08, h * 0.95);
  ctx.closePath();
  ctx.fillStyle = beam;
  ctx.fill();
  ctx.shadowColor = 'rgba(93, 228, 255, 0.9)';
  ctx.shadowBlur = h * 0.08;
  ctx.globalAlpha = 0.9;
  ctx.drawImage(photo, -w / 2, -h / 2, w, h);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(93, 228, 255, 0.12)';
  const step = Math.max(4, h / 90);
  for (let yy = -h / 2; yy < h / 2; yy += step * 2) ctx.fillRect(-w / 2, yy, w, step);
  const sweep = -h / 2 + ((t * 0.35) % 1) * h;
  ctx.fillStyle = 'rgba(180, 245, 255, 0.35)';
  ctx.fillRect(-w / 2, sweep, w, h * 0.03);
  ctx.lineWidth = Math.max(2, h * 0.008);
  ctx.strokeStyle = 'rgba(160, 240, 255, 0.95)';
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

// ---------- expression magic particles ----------
function starPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

function heartPath(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s * 0.9, -s * 0.2, -s * 0.45, -s * 0.85, 0, -s * 0.35);
  ctx.bezierCurveTo(s * 0.45, -s * 0.85, s * 0.9, -s * 0.2, 0, s * 0.35);
  ctx.closePath();
}

function drawRocket(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, s * 0.42);
  ctx.lineTo(0, s * (0.78 + Math.random() * 0.25));
  ctx.lineTo(s * 0.16, s * 0.42);
  ctx.closePath();
  ctx.fillStyle = '#ffb347';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.08, s * 0.42);
  ctx.lineTo(0, s * 0.62);
  ctx.lineTo(s * 0.08, s * 0.42);
  ctx.fillStyle = '#fff3b0';
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * s * 0.18, s * 0.12);
    ctx.lineTo(side * s * 0.38, s * 0.48);
    ctx.lineTo(side * s * 0.16, s * 0.4);
    ctx.closePath();
    ctx.fillStyle = '#ff5a6e';
    ctx.fill();
    outline(ctx, s * 0.05);
  }
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.55);
  ctx.quadraticCurveTo(s * 0.3, -s * 0.22, s * 0.2, s * 0.44);
  ctx.lineTo(-s * 0.2, s * 0.44);
  ctx.quadraticCurveTo(-s * 0.3, -s * 0.22, 0, -s * 0.55);
  ctx.fillStyle = '#f4f6ff';
  ctx.fill();
  outline(ctx, s * 0.06);
  ctx.beginPath();
  ctx.arc(0, -s * 0.1, s * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#5de4ff';
  ctx.fill();
  outline(ctx, s * 0.045);
}

function drawBolt(ctx: CanvasRenderingContext2D, len: number, alpha: number) {
  // A fresh jagged path every frame makes the lightning crackle.
  const pts: Pt[] = [{ x: 0, y: 0 }];
  const n = 9;
  for (let i = 1; i <= n; i++) pts.push({ x: (len * i) / n, y: i === n ? rand(-len * 0.05, len * 0.05) : rand(-len * 0.09, len * 0.09) });
  for (const [w, color] of [[len * 0.11, 'rgba(93, 228, 255, ' + 0.4 * alpha + ')'], [len * 0.05, 'rgba(180, 240, 255, ' + alpha + ')'], [len * 0.02, 'rgba(255, 255, 255, ' + alpha + ')']] as const) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]) {
  for (const p of list) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.kind === 'smoke') {
      ctx.globalAlpha = a * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * (1.6 - a * 0.6), 0, Math.PI * 2);
      ctx.fillStyle = '#e8ecf5';
      ctx.fill();
    } else if (p.kind === 'rocket') {
      drawRocket(ctx, p.size);
    } else if (p.kind === 'bolt') {
      drawBolt(ctx, p.size, a);
    } else if (p.kind === 'planet') {
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      outline(ctx, p.size * 0.18);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 1.8, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.lineWidth = p.size * 0.22;
      ctx.strokeStyle = '#ffe08a';
      ctx.stroke();
    } else if (p.kind === 'heart') {
      ctx.globalAlpha = Math.min(1, a * 2);
      heartPath(ctx, p.size);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = p.size * 0.1;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    } else {
      // star, spark and dust glow additively
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = p.kind === 'dust' ? a * 0.8 : Math.min(1, a * 2);
      if (p.kind === 'dust') {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        g.addColorStop(0, p.color);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
      } else {
        starPath(ctx, p.size);
        ctx.fillStyle = p.color;
        ctx.fill();
        starPath(ctx, p.size * 0.45);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function stepParticles(list: Particle[], dt: number, h: number): Particle[] {
  const out: Particle[] = [];
  for (const p of list) {
    p.life -= dt;
    if (p.life <= 0) continue;
    if (p.kind === 'rocket') {
      // rockets speed up and leave a smoke trail
      p.vx *= 1 + dt * 1.4;
      p.vy *= 1 + dt * 1.4;
      p.rot = Math.atan2(p.vy, p.vx) + Math.PI / 2;
      const back = turn({ x: 0, y: p.size * 0.6 }, p.rot);
      out.push({ kind: 'smoke', x: p.x + back.x, y: p.y + back.y, vx: rand(-20, 20), vy: rand(-10, 30), life: 0.7, max: 0.7, size: p.size * 0.16, rot: 0, vr: 0, color: '#fff' });
    } else if (p.kind === 'star' || p.kind === 'planet') {
      p.vy += h * 0.9 * dt;
    } else if (p.kind === 'smoke') {
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.y > h * 1.3 || p.y < -h * 0.5) continue;
    out.push(p);
  }
  return out.length > 500 ? out.slice(out.length - 500) : out;
}

// ---------- portal (person cut-out in the AI photo's scene) ----------
type Portal = {
  bg: HTMLImageElement | null;
  tint: string;
  shade: string;
  rim: string;
  mask: HTMLCanvasElement;
  maskData: ImageData | null;
  prev: Float32Array | null;
  glow: HTMLCanvasElement;
  person: HTMLCanvasElement;
  input: HTMLCanvasElement;
  parallax: Pt;
  dust: Particle[];
};

function sceneColors(img: HTMLImageElement): { tint: string; shade: string; rim: string } {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, 8, 8);
  const d = ctx.getImageData(0, 0, 8, 8).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let br = { v: -1, r: 255, g: 255, b: 255 };
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
    const v = d[i] + d[i + 1] + d[i + 2];
    if (v > br.v) br = { v, r: d[i], g: d[i + 1], b: d[i + 2] };
  }
  const n = d.length / 4;
  // Rim light takes the brightest colour in the scene, lifted toward white.
  const lift = (x: number) => Math.round(x + (255 - x) * 0.45);
  // The shade multiplies the person: dark scenes dim them, bright scenes barely change them.
  const shade = (x: number) => Math.round(x + (255 - x) * 0.55);
  const [ar, ag, ab] = [r / n, g / n, b / n];
  return {
    tint: 'rgb(' + Math.round(ar) + ',' + Math.round(ag) + ',' + Math.round(ab) + ')',
    shade: 'rgb(' + shade(ar) + ',' + shade(ag) + ',' + shade(ab) + ')',
    rim: 'rgb(' + lift(br.r) + ',' + lift(br.g) + ',' + lift(br.b) + ')',
  };
}

function updateMask(portal: Portal, data: Float32Array, w: number, h: number) {
  if (portal.mask.width !== w || portal.mask.height !== h || !portal.maskData) {
    portal.mask.width = w;
    portal.mask.height = h;
    portal.maskData = new ImageData(w, h);
    portal.prev = null;
  }
  const out = portal.maskData.data;
  const prev = portal.prev && portal.prev.length === data.length ? portal.prev : null;
  const next = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    // Average with the last frame against flicker, then sharpen the soft edge.
    const c = prev ? prev[i] * 0.4 + data[i] * 0.6 : data[i];
    next[i] = c;
    // A slightly high threshold trims the fringe of the real room around the person.
    const e = Math.min(1, Math.max(0, (c - 0.42) / 0.4));
    const a = e * e * (3 - 2 * e);
    const o = i * 4;
    out[o] = 255;
    out[o + 1] = 255;
    out[o + 2] = 255;
    out[o + 3] = a * 255;
  }
  portal.prev = next;
  portal.mask.getContext('2d')!.putImageData(portal.maskData, 0, 0);
}

function drawPortal(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, mirror: boolean, portal: Portal, face: Face | undefined, t: number, dt: number) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const bg = portal.bg!;
  // 1. scene with a little parallax that follows the head
  const target = face ? { x: -(face.center.x / W - 0.5) * W * 0.12, y: -(face.center.y / H - 0.45) * H * 0.08 } : { x: 0, y: 0 };
  portal.parallax.x += (target.x + Math.sin(t * 0.3) * W * 0.01 - portal.parallax.x) * 0.08;
  portal.parallax.y += (target.y - portal.parallax.y) * 0.08;
  const scale = Math.max(W / bg.naturalWidth, H / bg.naturalHeight) * 1.14;
  const dw = bg.naturalWidth * scale;
  const dh = bg.naturalHeight * scale;
  const px = Math.max(-(dw - W) / 2, Math.min((dw - W) / 2, portal.parallax.x));
  const py = Math.max(-(dh - H) / 2, Math.min((dh - H) / 2, portal.parallax.y));
  ctx.drawImage(bg, (W - dw) / 2 + px, (H - dh) / 2 + py, dw, dh);

  // dust behind the person
  portal.dust = stepDust(portal.dust, dt, W, H);
  drawParticles(ctx, portal.dust.filter((_, i) => i % 2 === 0));

  // 2. glow around the silhouette (a very soft copy of the mask in the rim colour)
  const g = portal.glow;
  g.width = Math.max(16, Math.round(W / 10));
  g.height = Math.max(16, Math.round(H / 10));
  const gc = g.getContext('2d')!;
  gc.clearRect(0, 0, g.width, g.height);
  gc.drawImage(portal.mask, 0, 0, g.width, g.height);
  gc.globalCompositeOperation = 'source-in';
  gc.fillStyle = portal.rim;
  gc.fillRect(0, 0, g.width, g.height);
  gc.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalAlpha = 0.9 + 0.1 * Math.sin(t * 2);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(g, -W * 0.025, -H * 0.025, W * 1.05, H * 1.05);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35;
  ctx.drawImage(g, -W * 0.01, -H * 0.01, W * 1.02, H * 1.02);
  ctx.restore();

  // 3. the person, tinted with the scene light and cut out by the mask
  const p = portal.person;
  if (p.width !== W || p.height !== H) {
    p.width = W;
    p.height = H;
  }
  const pc = p.getContext('2d')!;
  pc.save();
  pc.clearRect(0, 0, W, H);
  if (mirror) {
    pc.translate(W, 0);
    pc.scale(-1, 1);
  }
  pc.drawImage(video, 0, 0, W, H);
  pc.restore();
  pc.globalCompositeOperation = 'soft-light';
  pc.globalAlpha = 0.7;
  pc.fillStyle = portal.tint;
  pc.fillRect(0, 0, W, H);
  pc.globalCompositeOperation = 'multiply';
  pc.fillStyle = portal.shade;
  pc.fillRect(0, 0, W, H);
  pc.globalAlpha = 1;
  pc.globalCompositeOperation = 'destination-in';
  pc.imageSmoothingQuality = 'high';
  pc.drawImage(portal.mask, 0, 0, W, H);
  pc.globalCompositeOperation = 'source-over';
  ctx.drawImage(p, 0, 0);

  // dust in front of the person
  drawParticles(ctx, portal.dust.filter((_, i) => i % 2 === 1));
}

function stepDust(list: Particle[], dt: number, w: number, h: number): Particle[] {
  const out = list.filter((p) => (p.life -= dt) > 0);
  for (const p of out) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  while (out.length < 44) {
    const life = rand(3, 7);
    out.push({ kind: 'dust', x: rand(0, w), y: rand(0, h), vx: rand(-12, 12), vy: rand(-28, -6), life, max: life, size: rand(w * 0.004, w * 0.012), rot: 0, vr: 0, color: pick(['#ffffff', '#cdf6ff', '#ffe9a8']) });
  }
  return out;
}

type Props = { photoSrc: string; backgroundId?: string; onClose: () => void };

export default function ArCamera({ photoSrc, backgroundId, onClose }: Props) {
  const startBg = BACKGROUNDS.some((b) => b.id === backgroundId) ? backgroundId! : 'space-galaxy';
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [effect, setEffect] = useState<EffectId>('portal');
  const [bgId, setBgId] = useState(startBg);
  const [status, setStatus] = useState<Status>('starting');
  const [tracker, setTracker] = useState<Loadable>('loading');
  const [segmenter, setSegmenter] = useState<Loadable>('idle');
  const [faceCount, setFaceCount] = useState(0);
  const [magicOn, setMagicOn] = useState<Partial<Record<MagicId, boolean>>>({});
  const [capture, setCapture] = useState<Capture | null>(null);
  const [recording, setRecording] = useState(0);
  const [flash, setFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const segmenterRef = useRef<ImageSegmenter | null>(null);
  const facesRef = useRef<Face[]>([]);
  const faceCountRef = useRef(0);
  const effectRef = useRef(effect);
  effectRef.current = effect;
  const mirrorRef = useRef(true);
  mirrorRef.current = facing === 'user';
  const photoRef = useRef<HTMLImageElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const magicState = useRef<FaceMagicState[]>([]);
  const magicTimers = useRef<Partial<Record<MagicId, ReturnType<typeof setTimeout>>>>({});
  const portalRef = useRef<Portal | null>(null);
  const filesRef = useRef<Promise<unknown> | null>(null);
  const zapFlashRef = useRef(0);

  if (!portalRef.current && typeof document !== 'undefined') {
    portalRef.current = {
      bg: null,
      tint: 'rgb(40,50,90)',
      shade: 'rgb(200,205,225)',
      rim: 'rgb(180,220,255)',
      mask: document.createElement('canvas'),
      maskData: null,
      prev: null,
      glow: document.createElement('canvas'),
      person: document.createElement('canvas'),
      input: document.createElement('canvas'),
      parallax: { x: 0, y: 0 },
      dust: [],
    };
  }

  useEffect(() => {
    const img = new Image();
    img.onload = () => (photoRef.current = img);
    img.src = photoSrc;
  }, [photoSrc]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const portal = portalRef.current;
      if (!portal) return;
      portal.bg = img;
      Object.assign(portal, sceneColors(img));
    };
    img.src = '/presets/backgrounds/ref/' + bgId + '.webp';
  }, [bgId]);

  const files = useCallback(async () => {
    const { FilesetResolver } = await import('@mediapipe/tasks-vision');
    if (!filesRef.current) filesRef.current = FilesetResolver.forVisionTasks(WASM_BASE);
    return filesRef.current as ReturnType<typeof FilesetResolver.forVisionTasks>;
  }, []);

  // Camera stream; restarts when switching between the front and back camera.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setStatus('starting');
    facesRef.current = [];
    if (!navigator.mediaDevices) {
      setStatus('denied');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((tr) => tr.stop());
          return;
        }
        stream = s;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = s;
        await v.play().catch(() => undefined);
        setStatus('live');
      })
      .catch((err) => {
        console.warn('AR camera unavailable', err);
        if (!cancelled) setStatus('denied');
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [facing]);

  // Face tracker with expression scores: GPU first, CPU as a fallback.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
      const fs = await files();
      const make = (delegate: 'GPU' | 'CPU') =>
        FaceLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate },
          runningMode: 'VIDEO',
          numFaces: 3,
          outputFaceBlendshapes: true,
        });
      const lm = await make('GPU').catch(() => make('CPU'));
      if (cancelled) {
        lm.close();
        return;
      }
      landmarkerRef.current = lm;
      setTracker('ready');
    })().catch((error) => {
      console.warn('face tracker unavailable', error);
      if (!cancelled) setTracker('failed');
    });
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [files]);

  // Person cut-out, loaded the first time the portal effect is used.
  useEffect(() => {
    if (effect !== 'portal' || segmenter !== 'idle') return;
    setSegmenter('loading');
    (async () => {
      const { ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const fs = await files();
      const make = (delegate: 'GPU' | 'CPU') =>
        ImageSegmenter.createFromOptions(fs, {
          baseOptions: { modelAssetPath: SEGMENT_MODEL, delegate },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        });
      segmenterRef.current = await make('GPU').catch(() => make('CPU'));
      setSegmenter('ready');
    })().catch((error) => {
      console.warn('person cut-out unavailable', error);
      setSegmenter('failed');
    });
  }, [effect, segmenter, files]);

  useEffect(
    () => () => {
      segmenterRef.current?.close();
      segmenterRef.current = null;
      Object.values(magicTimers.current).forEach((tm) => tm && clearTimeout(tm));
    },
    []
  );

  const showMagic = useCallback((id: MagicId) => {
    // Each chip lights up on its own, so two expressions at once both show.
    if (magicTimers.current[id]) clearTimeout(magicTimers.current[id]);
    else setMagicOn((m) => ({ ...m, [id]: true }));
    magicTimers.current[id] = setTimeout(() => {
      magicTimers.current[id] = undefined;
      setMagicOn((m) => ({ ...m, [id]: false }));
    }, 700);
  }, []);

  // Draw loop: camera (or portal scene), the chosen effect, then expression magic on top.
  useEffect(() => {
    let raf = 0;
    let lastVideoTime = -1;
    let last = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || v.readyState < 2 || !v.videoWidth) return;
      if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
      }
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const W = c.width;
      const H = c.height;
      const mirror = mirrorRef.current;
      const fx = effectRef.current;
      const fresh = v.currentTime !== lastVideoTime;
      lastVideoTime = v.currentTime;

      const lm = landmarkerRef.current;
      if (lm && fresh) {
        try {
          const res = lm.detectForVideo(v, now);
          const next = res.faceLandmarks.map((l, i) => {
            const blend: Record<string, number> = {};
            for (const cat of res.faceBlendshapes?.[i]?.categories ?? []) blend[cat.categoryName] = cat.score;
            return toFace(l, blend, W, H, mirror);
          });
          facesRef.current = smoothFaces(facesRef.current, next);
        } catch (error) {
          console.warn('face tracking frame failed', error);
        }
      }
      const faces = facesRef.current;
      if (faces.length !== faceCountRef.current) {
        faceCountRef.current = faces.length;
        setFaceCount(faces.length);
      }

      const portal = portalRef.current;
      const seg = segmenterRef.current;
      if (fx === 'portal' && portal?.bg && seg) {
        if (fresh) {
          const input = portal.input;
          input.width = SEGMENT_WIDTH;
          input.height = Math.round((SEGMENT_WIDTH * H) / W);
          const ic = input.getContext('2d')!;
          ic.save();
          if (mirror) {
            ic.translate(input.width, 0);
            ic.scale(-1, 1);
          }
          ic.drawImage(v, 0, 0, input.width, input.height);
          ic.restore();
          try {
            const res = seg.segmentForVideo(input, now);
            const mask = res.confidenceMasks?.[0];
            if (mask) updateMask(portal, mask.getAsFloat32Array(), mask.width, mask.height);
            res.close();
          } catch (error) {
            console.warn('cut-out frame failed', error);
          }
        }
        if (portal.maskData) drawPortal(ctx, v, mirror, portal, faces[0], t, dt);
      } else {
        ctx.save();
        if (mirror) {
          ctx.translate(W, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(v, 0, 0, W, H);
        ctx.restore();
      }

      if (fx === 'hologram') {
        if (photoRef.current) drawHologram(ctx, photoRef.current, faces[0], c, t);
      } else {
        for (const f of faces) {
          if (fx === 'helmet') drawHelmet(ctx, f, t);
          else if (fx === 'einstein') drawEinstein(ctx, f, t);
          else if (fx === 'goggles') drawGoggles(ctx, f);
          else if (fx === 'planets') drawPlanets(ctx, f, t);
          else if (fx === 'bulb') drawBulb(ctx, f, t);
        }
      }

      // Expression magic: every tracked face can trigger it.
      const parts = particlesRef.current;
      faces.forEach((f, i) => {
        const st = (magicState.current[i] ??= { closedSince: 0, lastZap: 0, browUp: false, lastRocket: 0, lastSparkle: 0 });
        const b = f.blend;
        const up = upOf(f);
        if ((b.jawOpen ?? 0) > 0.45 && now - st.lastRocket > 170) {
          st.lastRocket = now;
          const dir = turn(up, rand(-0.55, 0.55));
          const speed = f.width * rand(1.6, 2.4);
          parts.push({ kind: 'rocket', x: f.mouth.x, y: f.mouth.y, vx: dir.x * speed, vy: dir.y * speed, life: 1.6, max: 1.6, size: f.width * rand(0.3, 0.42), rot: 0, vr: 0, color: '#fff' });
          showMagic('rocket');
        }
        const closed = ((b.eyeBlinkLeft ?? 0) + (b.eyeBlinkRight ?? 0)) / 2 > 0.55;
        if (!closed) st.closedSince = 0;
        else if (!st.closedSince) st.closedSince = now;
        // A held eye-close (not a natural blink) fires the lightning.
        if (closed && st.closedSince && now - st.closedSince > 220 && now - st.lastZap > 700) {
          st.lastZap = now;
          zapFlashRef.current = now;
          // Two crackling bolts shoot sideways out of each eye.
          for (const [eye, side] of [[f.leftEye, -1], [f.rightEye, 1]] as const) {
            for (const spread of [-0.45, -0.05, 0.35]) {
              const dir = turn(up, side * (Math.PI / 2 + spread));
              parts.push({ kind: 'bolt', x: eye.x, y: eye.y, vx: 0, vy: 0, life: 0.55, max: 0.55, size: f.width * rand(1.6, 2.3), rot: Math.atan2(dir.y, dir.x), vr: 0, color: '#fff' });
            }
          }
          showMagic('zap');
        }
        const brow = (b.browInnerUp ?? 0) > 0.55;
        if (brow && !st.browUp) {
          for (let k = 0; k < 22; k++) {
            const dir = turn(up, rand(-1.3, 1.3));
            const speed = f.width * rand(1.8, 3.4);
            const planet = k % 6 === 0;
            parts.push({
              kind: planet ? 'planet' : 'star',
              x: f.forehead.x,
              y: f.forehead.y,
              vx: dir.x * speed,
              vy: dir.y * speed,
              life: 1.8,
              max: 1.8,
              size: f.width * (planet ? rand(0.07, 0.1) : rand(0.05, 0.09)),
              rot: rand(0, 6.28),
              vr: rand(-4, 4),
              color: planet ? pick(['#ffb35c', '#5de4ff', '#ff7ad9', '#7dff9c']) : pick(BRIGHT),
            });
          }
          showMagic('stars');
        }
        st.browUp = brow;
        const smile = ((b.mouthSmileLeft ?? 0) + (b.mouthSmileRight ?? 0)) / 2 > 0.55;
        if (smile && now - st.lastSparkle > 120) {
          st.lastSparkle = now;
          const a = rand(0, Math.PI * 2);
          const heart = Math.random() < 0.35;
          parts.push({
            kind: heart ? 'heart' : 'spark',
            x: f.center.x + Math.cos(a) * f.width * 0.75,
            y: f.center.y + Math.sin(a) * f.height * 0.65,
            vx: rand(-15, 15),
            vy: -f.width * rand(0.25, 0.5),
            life: 1.4,
            max: 1.4,
            size: f.width * rand(0.05, 0.09),
            rot: rand(-0.4, 0.4),
            vr: rand(-1, 1),
            color: heart ? pick(['#ff7ad9', '#ff5a6e']) : pick(BRIGHT),
          });
          showMagic('sparkle');
        }
      });
      particlesRef.current = stepParticles(parts, dt, H);
      drawParticles(ctx, particlesRef.current);
      // Lightning lights up the whole frame for a moment.
      const flashAge = now - zapFlashRef.current;
      if (flashAge < 260) {
        ctx.fillStyle = 'rgba(170, 235, 255, ' + 0.35 * (1 - flashAge / 260) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [showMagic]);

  const takePhoto = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !c.width) return;
    try {
      setCapture({ kind: 'photo', url: c.toDataURL('image/jpeg', 0.92) });
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
    } catch (error) {
      console.error('AR capture failed', error);
    }
  }, []);

  const recordClip = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !c.width || recording || typeof MediaRecorder === 'undefined') return;
    try {
      const stream = c.captureStream(30);
      const mime = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = () => {
        setRecording(0);
        setCapture({ kind: 'video', url: URL.createObjectURL(new Blob(chunks, { type: mime })), mime });
      };
      recorder.start();
      setRecording(CLIP_SECONDS);
      for (let s = 1; s < CLIP_SECONDS; s++) setTimeout(() => setRecording(CLIP_SECONDS - s), s * 1000);
      setTimeout(() => recorder.stop(), CLIP_SECONDS * 1000);
    } catch (error) {
      console.error('AR clip failed', error);
      setRecording(0);
    }
  }, [recording]);

  const closeCapture = () => {
    if (capture?.kind === 'video') URL.revokeObjectURL(capture.url);
    setCapture(null);
  };

  const fileName = () => 'ai-hancut-ar-' + Date.now() + (capture?.kind === 'video' ? (capture.mime.includes('mp4') ? '.mp4' : '.webm') : '.jpg');

  const save = () => {
    if (!capture) return;
    const a = document.createElement('a');
    a.href = capture.url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';
  const share = async () => {
    if (!capture) return;
    try {
      const blob = await (await fetch(capture.url)).blob();
      const file = new File([blob], fileName(), { type: blob.type || (capture.kind === 'video' ? capture.mime : 'image/jpeg') });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'AI한컷 AR' });
      else save();
    } catch {
      // The visitor closed the share sheet.
    }
  };

  const needsFace = effect !== 'hologram';
  const hint =
    status !== 'live'
      ? null
      : effect === 'portal' && segmenter === 'loading'
        ? { busy: true, text: '사진 속 세계를 여는 중이에요' }
        : effect === 'portal' && segmenter === 'failed'
          ? { busy: false, text: '이 휴대폰에서는 배경 바꾸기를 쓸 수 없어요' }
          : tracker === 'loading' && needsFace
            ? { busy: true, text: 'AR 효과를 준비하는 중이에요' }
            : tracker === 'failed' && needsFace
              ? { busy: false, text: '이 휴대폰에서는 얼굴 효과를 쓸 수 없어요' }
              : tracker === 'ready' && faceCount === 0
                ? { busy: false, text: effect === 'portal' ? '한 걸음 물러나 상반신까지 비춰 주세요' : '얼굴을 화면에 비춰 주세요' }
                : null;

  return (
    <div role="dialog" aria-modal="true" aria-label="AR 카메라" className="fixed inset-0 z-[90] flex flex-col bg-black text-white">
      <video ref={videoRef} playsInline muted autoPlay className="pointer-events-none absolute left-0 top-0 size-px opacity-0" />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 size-full object-cover" />
        {flash && <div className="absolute inset-0 bg-white" />}

        <div className="absolute inset-x-0 top-0 flex flex-col gap-2 bg-gradient-to-b from-black/70 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onClose} aria-label="AR 카메라 닫기" className="flex size-11 items-center justify-center rounded-full bg-black/50 backdrop-blur">
              <X className="size-6" aria-hidden />
            </button>
            <span className="rounded-full bg-black/50 px-3 py-1 text-sm font-semibold text-cyan-200 backdrop-blur">
              {recording ? '● 녹화 중 ' + recording + '초' : 'AR 과학 카메라'}
            </span>
            <button
              type="button"
              onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
              aria-label="카메라 전환"
              className="flex size-11 items-center justify-center rounded-full bg-black/50 backdrop-blur"
            >
              <SwitchCamera className="size-6" aria-hidden />
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5" aria-label="표정 마법">
            {MAGIC.map((m) => (
              <span
                key={m.id}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur transition-all duration-150',
                  magicOn[m.id] ? 'scale-110 bg-amber-400 text-slate-950' : 'bg-black/45 text-white/85'
                )}
              >
                <span aria-hidden>{m.icon}</span>
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-cyan-100">
            <Loader2 className="size-9 animate-spin" aria-hidden />
            <span>카메라를 켜는 중이에요</span>
          </div>
        )}
        {status === 'denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-lg font-semibold">카메라를 쓸 수 없어요</p>
            <p className="text-sm text-white/70">브라우저 주소창의 카메라 권한을 허용한 뒤 다시 열어 주세요.</p>
            <button type="button" onClick={onClose} className="rounded-xl bg-cyan-500 px-6 py-2.5 font-semibold text-slate-950">
              돌아가기
            </button>
          </div>
        )}
        {hint && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
            <span className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-1.5 text-center text-sm backdrop-blur">
              {hint.busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {hint.text}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 bg-black px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {effect === 'portal' && (
          <div className="scrollbar-none flex gap-2 overflow-x-auto px-1" aria-label="배경 고르기">
            {BACKGROUNDS.slice()
              .sort((a, b) => (a.id === startBg ? -1 : b.id === startBg ? 1 : 0))
              .map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBgId(b.id)}
                  aria-pressed={bgId === b.id}
                  className={cn('relative w-14 shrink-0 overflow-hidden rounded-xl border-2', bgId === b.id ? 'border-cyan-400' : 'border-transparent opacity-80')}
                >
                  <img src={b.thumb} alt={b.name} className="aspect-[4/5] w-full object-cover" loading="lazy" draggable={false} />
                  {b.id === backgroundId && <span className="absolute inset-x-0 bottom-0 bg-cyan-500/90 text-[10px] font-bold text-slate-950">내 사진</span>}
                </button>
              ))}
          </div>
        )}
        <div className="scrollbar-none flex gap-2 overflow-x-auto px-1">
          {EFFECTS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setEffect(e.id)}
              aria-pressed={effect === e.id}
              className={cn(
                'flex shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs transition-colors',
                effect === e.id ? 'bg-cyan-500 text-slate-950' : 'bg-white/10 text-white/85'
              )}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {e.icon}
              </span>
              <span className="whitespace-nowrap font-semibold">{e.label}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 items-center">
          <span />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={takePhoto}
              disabled={status !== 'live' || recording > 0}
              aria-label="AR 사진 찍기"
              className="size-[72px] rounded-full border-[5px] border-white bg-white/25 transition-transform active:scale-90 disabled:opacity-40"
            />
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={recordClip}
              disabled={status !== 'live' || recording > 0}
              aria-label={CLIP_SECONDS + '초 AR 영상 찍기'}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-2 text-[11px] font-semibold disabled:opacity-60',
                recording ? 'bg-red-500 text-white' : 'bg-white/10 text-white/85'
              )}
            >
              <Video className="size-5" aria-hidden />
              {recording ? recording + '초' : CLIP_SECONDS + '초 영상'}
            </button>
          </div>
        </div>
      </div>

      {capture && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/90 p-5">
          {capture.kind === 'photo' ? (
            <img src={capture.url} alt="찍은 AR 사진" className="max-h-[70dvh] max-w-full rounded-2xl border-2 border-cyan-400/60 object-contain" />
          ) : (
            <video src={capture.url} autoPlay loop muted playsInline className="max-h-[70dvh] max-w-full rounded-2xl border-2 border-cyan-400/60" />
          )}
          <div className="grid w-full max-w-sm grid-cols-3 gap-2">
            <button type="button" onClick={closeCapture} className="flex flex-col items-center gap-1 rounded-xl bg-white/10 py-2.5 text-sm font-semibold">
              <RotateCcw className="size-5" aria-hidden /> 다시 찍기
            </button>
            <button type="button" onClick={save} className="flex flex-col items-center gap-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950">
              <Download className="size-5" aria-hidden /> 저장
            </button>
            <button type="button" onClick={share} disabled={!canShare} className="flex flex-col items-center gap-1 rounded-xl bg-white/10 py-2.5 text-sm font-semibold disabled:opacity-40">
              <Share2 className="size-5" aria-hidden /> 공유
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
