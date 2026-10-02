'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, RotateCcw, Share2, SwitchCamera, X } from 'lucide-react';
import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { cn } from '@/lib/utils';

// Face tracking runs on the visitor's phone (MediaPipe Face Landmarker). The ~23 MB wasm
// and the 3.7 MB model come from public CDNs so the repository and server stay small.
const TASKS_VERSION = '1.0.1';
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + TASKS_VERSION + '/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const INK = '#2b2350';

type EffectId = 'hologram' | 'helmet' | 'einstein' | 'goggles' | 'planets' | 'bulb';
const EFFECTS: { id: EffectId; label: string; icon: string }[] = [
  { id: 'hologram', label: '내 사진 홀로그램', icon: '🖼️' },
  { id: 'helmet', label: '우주 헬멧', icon: '🧑‍🚀' },
  { id: 'einstein', label: '아인슈타인', icon: '👨‍🔬' },
  { id: 'goggles', label: '실험 고글', icon: '🥽' },
  { id: 'planets', label: '행성 왕관', icon: '🪐' },
  { id: 'bulb', label: '아이디어 전구', icon: '💡' },
];

type Pt = { x: number; y: number };
/** Face anchors in canvas pixels; local drawing uses the face centre and head roll. */
type Face = { center: Pt; nose: Pt; mouth: Pt; leftEye: Pt; rightEye: Pt; width: number; height: number; roll: number };
type Status = 'starting' | 'live' | 'denied';
type Tracker = 'loading' | 'ready' | 'failed';

const avg = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function toFace(lm: NormalizedLandmark[], w: number, h: number, mirror: boolean): Face {
  const p = (i: number): Pt => ({ x: (mirror ? 1 - lm[i].x : lm[i].x) * w, y: lm[i].y * h });
  const top = p(10);
  const chin = p(152);
  return {
    center: avg(top, chin),
    nose: p(1),
    mouth: p(13),
    leftEye: avg(p(33), p(133)),
    rightEye: avg(p(362), p(263)),
    width: dist(p(234), p(454)),
    height: dist(top, chin),
    // Chin-to-forehead direction gives the head roll whatever the mirroring.
    roll: Math.atan2(top.y - chin.y, top.x - chin.x) + Math.PI / 2,
  };
}

/** Moves the context into face space: origin at the face centre, rotated with the head. */
function enterFace(ctx: CanvasRenderingContext2D, f: Face) {
  ctx.translate(f.center.x, f.center.y);
  ctx.rotate(f.roll);
}
function toLocal(f: Face, p: Pt): Pt {
  const dx = p.x - f.center.x;
  const dy = p.y - f.center.y;
  const c = Math.cos(-f.roll);
  const s = Math.sin(-f.roll);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

function outline(ctx: CanvasRenderingContext2D, width: number) {
  ctx.lineWidth = width;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawHelmet(ctx: CanvasRenderingContext2D, f: Face, t: number) {
  const r = f.height * 0.98;
  ctx.save();
  enterFace(ctx, f);
  const cy = -f.height * 0.06;
  // collar ring below the chin
  ctx.beginPath();
  ctx.ellipse(0, cy + r * 0.92, r * 0.72, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#dfe4f0';
  ctx.fill();
  outline(ctx, Math.max(3, r * 0.025));
  // glass
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
  // reflection
  ctx.beginPath();
  ctx.arc(0, cy, r * 0.82, Math.PI * 1.1, Math.PI * 1.38);
  ctx.lineWidth = r * 0.06;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.stroke();
  // antenna with a blinking light
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
  // Wild white hair: an outer ring of big puffs from ear to ear over the head, then a
  // smaller inner ring; everything wobbles a little as if it had a life of its own.
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
  // bushy moustache between nose and mouth
  const m = avg(toLocal(f, f.nose), toLocal(f, f.mouth));
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(m.x + side * f.width * 0.11, m.y + f.height * 0.01);
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
  // strap behind the lenses
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
  // projection beam
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
  // scan lines sweeping down
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

type Props = { photoSrc: string; onClose: () => void };

export default function ArCamera({ photoSrc, onClose }: Props) {
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [effect, setEffect] = useState<EffectId>('hologram');
  const [status, setStatus] = useState<Status>('starting');
  const [tracker, setTracker] = useState<Tracker>('loading');
  const [faceCount, setFaceCount] = useState(0);
  const [shot, setShot] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const facesRef = useRef<Face[]>([]);
  const faceCountRef = useRef(0);
  const effectRef = useRef(effect);
  effectRef.current = effect;
  const mirrorRef = useRef(true);
  mirrorRef.current = facing === 'user';
  const photoRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => (photoRef.current = img);
    img.src = photoSrc;
  }, [photoSrc]);

  // Camera stream; restarts when switching between the front and back camera.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setStatus('starting');
    facesRef.current = [];
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
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
    if (!navigator.mediaDevices) setStatus('denied');
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [facing]);

  // Face tracker: GPU first, CPU as a fallback.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(WASM_BASE);
      const make = (delegate: 'GPU' | 'CPU') =>
        FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: 'VIDEO', numFaces: 3 });
      let lm: FaceLandmarker;
      try {
        lm = await make('GPU');
      } catch {
        lm = await make('CPU');
      }
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
  }, []);

  // Draw loop: camera frame, then the chosen effect on every tracked face.
  useEffect(() => {
    let raf = 0;
    let lastVideoTime = -1;
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
      const mirror = mirrorRef.current;
      ctx.save();
      if (mirror) {
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(v, 0, 0, c.width, c.height);
      ctx.restore();

      const lm = landmarkerRef.current;
      if (lm && v.currentTime !== lastVideoTime) {
        lastVideoTime = v.currentTime;
        try {
          const res = lm.detectForVideo(v, performance.now());
          facesRef.current = res.faceLandmarks.map((l) => toFace(l, c.width, c.height, mirror));
        } catch (error) {
          console.warn('face tracking frame failed', error);
        }
      }
      const faces = facesRef.current;
      if (faces.length !== faceCountRef.current) {
        faceCountRef.current = faces.length;
        setFaceCount(faces.length);
      }
      const t = performance.now() / 1000;
      const fx = effectRef.current;
      if (fx === 'hologram') {
        if (photoRef.current) drawHologram(ctx, photoRef.current, faces[0], c, t);
        return;
      }
      for (const f of faces) {
        if (fx === 'helmet') drawHelmet(ctx, f, t);
        else if (fx === 'einstein') drawEinstein(ctx, f, t);
        else if (fx === 'goggles') drawGoggles(ctx, f);
        else if (fx === 'planets') drawPlanets(ctx, f, t);
        else if (fx === 'bulb') drawBulb(ctx, f, t);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const capture = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !c.width) return;
    try {
      setShot(c.toDataURL('image/jpeg', 0.92));
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
    } catch (error) {
      console.error('AR capture failed', error);
    }
  }, []);

  const save = () => {
    if (!shot) return;
    const a = document.createElement('a');
    a.href = shot;
    a.download = 'ai-hancut-ar-' + Date.now() + '.jpg';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';
  const share = async () => {
    if (!shot) return;
    try {
      const blob = await (await fetch(shot)).blob();
      const file = new File([blob], 'ai-hancut-ar.jpg', { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'AI한컷 AR 사진' });
      else save();
    } catch {
      // The visitor closed the share sheet.
    }
  };

  const needsFace = effect !== 'hologram';

  return (
    <div role="dialog" aria-modal="true" aria-label="AR 카메라" className="fixed inset-0 z-[90] flex flex-col bg-black text-white">
      <video ref={videoRef} playsInline muted autoPlay className="pointer-events-none absolute left-0 top-0 size-px opacity-0" />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 size-full object-cover" />
        {flash && <div className="absolute inset-0 bg-white" />}

        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button type="button" onClick={onClose} aria-label="AR 카메라 닫기" className="flex size-11 items-center justify-center rounded-full bg-black/50 backdrop-blur">
            <X className="size-6" aria-hidden />
          </button>
          <span className="rounded-full bg-black/50 px-3 py-1 text-sm font-semibold text-cyan-200 backdrop-blur">AR 카메라</span>
          <button
            type="button"
            onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
            aria-label="카메라 전환"
            className="flex size-11 items-center justify-center rounded-full bg-black/50 backdrop-blur"
          >
            <SwitchCamera className="size-6" aria-hidden />
          </button>
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
        {status === 'live' && (
          <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center">
            {tracker === 'loading' && needsFace && (
              <span className="flex items-center gap-2 rounded-full bg-black/55 px-4 py-1.5 text-sm backdrop-blur">
                <Loader2 className="size-4 animate-spin" aria-hidden /> AR 효과를 준비하는 중이에요
              </span>
            )}
            {tracker === 'ready' && needsFace && faceCount === 0 && (
              <span className="rounded-full bg-black/55 px-4 py-1.5 text-sm backdrop-blur">얼굴을 화면에 비춰 주세요</span>
            )}
            {tracker === 'failed' && needsFace && (
              <span className="rounded-full bg-black/55 px-4 py-1.5 text-sm backdrop-blur">이 휴대폰에서는 얼굴 효과를 쓸 수 없어요. 홀로그램을 골라 보세요</span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 bg-black px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
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
        <div className="flex justify-center">
          <button
            type="button"
            onClick={capture}
            disabled={status !== 'live'}
            aria-label="AR 사진 찍기"
            className="size-[72px] rounded-full border-[5px] border-white bg-white/25 transition-transform active:scale-90 disabled:opacity-40"
          />
        </div>
      </div>

      {shot && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/90 p-5">
          <img src={shot} alt="찍은 AR 사진" className="max-h-[70dvh] max-w-full rounded-2xl border-2 border-cyan-400/60 object-contain" />
          <div className="grid w-full max-w-sm grid-cols-3 gap-2">
            <button type="button" onClick={() => setShot(null)} className="flex flex-col items-center gap-1 rounded-xl bg-white/10 py-2.5 text-sm font-semibold">
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
