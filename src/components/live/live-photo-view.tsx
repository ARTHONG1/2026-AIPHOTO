'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import dynamic from 'next/dynamic';
import { Camera, Check, Download, Eye, Pause, Play, Share2, Sparkles, Sticker, Trash2, Video, Volume2, VolumeX, ZoomIn } from 'lucide-react';
import type { LivePhotoMeta } from '@/lib/storage';
import { PhotoZoom } from '@/components/photo-zoom';
import { STICKER_GROUPS, drawSticker, loadStickerImage, svgDataUrl, type PlacedSticker } from '@/components/live/stickers';
import { cn } from '@/lib/utils';

const ArCamera = dynamic(() => import('@/components/live/ar-camera'), { ssr: false });

type Props = {
  meta: LivePhotoMeta;
};

type Pt = { x: number; y: number };
type Gesture =
  | { mode: 'move'; uid: string; dx: number; dy: number }
  | { mode: 'handle'; uid: string; dist: number; angle: number; size: number; rot: number }
  | { mode: 'pinch'; uid: string; dist: number; angle: number; size: number; rot: number; x: number; y: number; mx: number; my: number };

const CANVAS_W = 720;
const CANVAS_H = 1080;
// Touch targets for the delete and resize handles, in canvas pixels (about 22 CSS px).
const HANDLE_R = 44;
const MIN_SIZE = 0.08;
const MAX_SIZE = 0.9;
const NEW_SIZE = 0.3;
const STORAGE_PREFIX = 'ai-hancut:stickers:';

const rotate = (p: Pt, a: number): Pt => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const angleOf = (from: Pt, to: Pt) => Math.atan2(to.y - from.y, to.x - from.x);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const phaseOf = (uid: string) => [...uid].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 628 / 100;
const centerOf = (s: PlacedSticker): Pt => ({ x: s.x * CANVAS_W, y: s.y * CANVAS_H });

export default function LivePhotoView({ meta }: Props) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [photoState, setPhotoState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [editing, setEditing] = useState(false);
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [trayGroup, setTrayGroup] = useState(STICKER_GROUPS[0].id);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [arSrc, setArSrc] = useState<string | null>(null);
  // Same-origin copy of the photo (see /api/live/[id]/photo): the storage bucket has no CORS headers.
  const photoSrc = '/api/live/' + encodeURIComponent(meta.id) + '/photo';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // The draw loop and gestures read these refs; state mirrors them for rendering.
  const stickersRef = useRef<PlacedSticker[]>([]);
  const selectedRef = useRef<string | null>(null);
  const editingRef = useRef(false);
  const playingRef = useRef(true);
  const stickerImages = useRef(new Map<string, CanvasImageSource>());
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture | null>(null);
  selectedRef.current = selected;
  editingRef.current = editing;
  playingRef.current = isPlaying;

  const commitStickers = useCallback((list: PlacedSticker[]) => {
    stickersRef.current = list;
    setStickers(list);
  }, []);

  const playChime = useCallback(() => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.6);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {
      // Audio autoplay policy
    }
  }, [isMuted]);

  useEffect(() => {
    let cancelled = false;
    setPhotoState('loading');
    const load = (src: string, onFail: () => void) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (cancelled) return;
        imgRef.current = img;
        setPhotoState('ready');
      };
      img.onerror = () => {
        if (!cancelled) onFail();
      };
      img.src = src;
    };
    // The direct storage URL still displays the photo if the app route fails; only the
    // video recording and sticker saving need the same-origin copy.
    load(photoSrc, () => load(meta.photoUrl, () => setPhotoState('error')));
    return () => {
      cancelled = true;
    };
  }, [photoSrc, meta.photoUrl]);

  // Stickers are kept per photo on this phone, so a refresh does not lose the decoration.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + meta.id);
      const list = raw ? (JSON.parse(raw) as PlacedSticker[]) : [];
      if (Array.isArray(list)) commitStickers(list.filter((s) => s && typeof s.defId === 'string'));
    } catch {
      // Private mode or broken data: start empty.
    }
  }, [meta.id, commitStickers]);

  useEffect(() => {
    try {
      if (stickers.length) localStorage.setItem(STORAGE_PREFIX + meta.id, JSON.stringify(stickers));
      else localStorage.removeItem(STORAGE_PREFIX + meta.id);
    } catch {
      // Storage full or blocked: decoration still works for this visit.
    }
    for (const s of stickers) {
      if (stickerImages.current.has(s.defId)) continue;
      loadStickerImage(s.defId)
        .then((img) => stickerImages.current.set(s.defId, img))
        .catch((error) => console.warn(error));
    }
  }, [stickers, meta.id]);

  // One draw loop for the whole page: photo, stickers, live effects and edit handles.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      radius: Math.random() * 2.2 + 0.8,
      speedY: Math.random() * 0.7 + 0.3,
      speedX: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.7 + 0.2,
      phase: Math.random() * Math.PI * 2,
    }));

    const startTime = performance.now();
    let frame = 0;

    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      const elapsed = (now - startTime) / 1000;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      const img = imgRef.current;
      if (!img || !img.complete) return;
      const motion = playingRef.current && !editingRef.current;

      ctx.save();
      if (motion) {
        const zoom = 1.0 + 0.04 * (0.5 + 0.5 * Math.sin(elapsed * 1.4));
        const swayX = Math.sin(elapsed * 1.1) * 6;
        const swayY = Math.cos(elapsed * 0.9) * 4;
        ctx.translate(CANVAS_W / 2 + swayX, CANVAS_H / 2 + swayY);
        ctx.scale(zoom, zoom);
        ctx.translate(-CANVAS_W / 2, -CANVAS_H / 2);
      }
      ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
      // Stickers ride along with the photo and wiggle a little while it is live.
      for (const s of stickersRef.current) {
        const src = stickerImages.current.get(s.defId);
        if (!src) continue;
        const ph = phaseOf(s.uid);
        const wobble = motion ? Math.sin(elapsed * 2.2 + ph) * 0.07 : 0;
        const pulse = motion ? 1 + 0.05 * Math.sin(elapsed * 3 + ph) : 1;
        drawSticker(ctx, src, s.x * CANVAS_W, s.y * CANVAS_H, s.size * CANVAS_W * pulse, s.rot + wobble);
      }
      ctx.restore();

      if (motion) {
        ctx.save();
        for (const p of particles) {
          p.y -= p.speedY;
          p.x += p.speedX;
          if (p.y < 0) p.y = CANVAS_H;
          if (p.x < 0) p.x = CANVAS_W;
          if (p.x > CANVAS_W) p.x = 0;

          const glow = 0.5 + 0.5 * Math.sin(elapsed * 2 + p.phase);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(180, 240, 255, ' + p.alpha * glow + ')';
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(100, 220, 255, 0.8)';
          ctx.fill();
        }
        ctx.restore();

        const sweepCycle = (elapsed % 4.5) / 4.5;
        if (sweepCycle < 0.45) {
          const sweepPos = (sweepCycle / 0.45) * (CANVAS_W + CANVAS_H) - CANVAS_H / 2;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const grad = ctx.createLinearGradient(sweepPos - 80, sweepPos - 80, sweepPos + 80, sweepPos + 80);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(0.5, 'rgba(120,220,255,0.25)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
          ctx.restore();
        }
      }

      const sel = editingRef.current ? stickersRef.current.find((s) => s.uid === selectedRef.current) : undefined;
      if (sel) drawSelection(ctx, sel);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  // ---------- sticker editing ----------
  const toCanvas = (e: ReactPointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * CANVAS_W) / r.width, y: ((e.clientY - r.top) * CANVAS_H) / r.height };
  };

  const hitTest = (p: Pt): { uid: string; part: 'body' | 'delete' | 'handle' } | null => {
    const list = stickersRef.current;
    const sel = list.find((s) => s.uid === selectedRef.current);
    if (sel) {
      const c = centerOf(sel);
      const half = (sel.size * CANVAS_W) / 2;
      const del = rotate({ x: half, y: -half }, sel.rot);
      if (dist(p, { x: c.x + del.x, y: c.y + del.y }) < HANDLE_R) return { uid: sel.uid, part: 'delete' };
      const h = rotate({ x: half, y: half }, sel.rot);
      if (dist(p, { x: c.x + h.x, y: c.y + h.y }) < HANDLE_R) return { uid: sel.uid, part: 'handle' };
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      const c = centerOf(s);
      const q = rotate({ x: p.x - c.x, y: p.y - c.y }, -s.rot);
      const half = (s.size * CANVAS_W) / 2;
      if (Math.abs(q.x) <= half && Math.abs(q.y) <= half) return { uid: s.uid, part: 'body' };
    }
    return null;
  };

  const patchSticker = (uid: string, patch: Partial<PlacedSticker>) => {
    stickersRef.current = stickersRef.current.map((s) => (s.uid === uid ? { ...s, ...patch } : s));
  };

  const startPinch = () => {
    const uid = selectedRef.current;
    const s = stickersRef.current.find((x) => x.uid === uid);
    const [a, b] = [...pointers.current.values()];
    if (!s || !a || !b) return;
    gesture.current = {
      mode: 'pinch',
      uid: s.uid,
      dist: dist(a, b) || 1,
      angle: angleOf(a, b),
      size: s.size,
      rot: s.rot,
      x: s.x,
      y: s.y,
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
    };
  };

  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!editingRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toCanvas(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size >= 2) {
      startPinch();
      return;
    }
    const hit = hitTest(p);
    if (!hit) {
      gesture.current = null;
      setSelected(null);
      return;
    }
    if (hit.part === 'delete') {
      pointers.current.delete(e.pointerId);
      gesture.current = null;
      commitStickers(stickersRef.current.filter((s) => s.uid !== hit.uid));
      setSelected(null);
      return;
    }
    // Bring the touched sticker to the front.
    const list = stickersRef.current;
    const s = list.find((x) => x.uid === hit.uid)!;
    stickersRef.current = [...list.filter((x) => x.uid !== hit.uid), s];
    selectedRef.current = hit.uid;
    setSelected(hit.uid);
    const c = centerOf(s);
    gesture.current =
      hit.part === 'handle'
        ? { mode: 'handle', uid: s.uid, dist: dist(p, c) || 1, angle: angleOf(c, p), size: s.size, rot: s.rot }
        : { mode: 'move', uid: s.uid, dx: p.x - c.x, dy: p.y - c.y };
  };

  const onCanvasPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = toCanvas(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.mode === 'move') {
      patchSticker(g.uid, { x: clamp((p.x - g.dx) / CANVAS_W, 0, 1), y: clamp((p.y - g.dy) / CANVAS_H, 0, 1) });
    } else if (g.mode === 'handle') {
      const s = stickersRef.current.find((x) => x.uid === g.uid);
      if (!s) return;
      const c = centerOf(s);
      patchSticker(g.uid, { size: clamp((g.size * dist(p, c)) / g.dist, MIN_SIZE, MAX_SIZE), rot: g.rot + angleOf(c, p) - g.angle });
    } else {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      patchSticker(g.uid, {
        size: clamp((g.size * dist(a, b)) / g.dist, MIN_SIZE, MAX_SIZE),
        rot: g.rot + angleOf(a, b) - g.angle,
        x: clamp(g.x + ((a.x + b.x) / 2 - g.mx) / CANVAS_W, 0, 1),
        y: clamp(g.y + ((a.y + b.y) / 2 - g.my) / CANVAS_H, 0, 1),
      });
    }
  };

  const onCanvasPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    gesture.current = null;
    if (pointers.current.size === 0) commitStickers([...stickersRef.current]);
  };

  const addSticker = (defId: string) => {
    const uid = Math.random().toString(36).slice(2, 10);
    const n = stickersRef.current.length;
    const s: PlacedSticker = {
      uid,
      defId,
      // New stickers fan out around the middle so they do not stack exactly.
      x: clamp(0.5 + Math.cos(n * 2.4) * 0.18, 0.15, 0.85),
      y: clamp(0.42 + Math.sin(n * 2.4) * 0.2, 0.15, 0.85),
      size: NEW_SIZE,
      rot: (Math.random() - 0.5) * 0.5,
    };
    loadStickerImage(defId)
      .then((img) => stickerImages.current.set(defId, img))
      .catch((error) => console.warn(error));
    commitStickers([...stickersRef.current, s]);
    setSelected(uid);
  };

  const finishEditing = () => {
    setEditing(false);
    setSelected(null);
  };

  // ---------- still image (photo + stickers at full resolution) ----------
  const composeStill = useCallback(async (): Promise<string | null> => {
    const img = imgRef.current;
    if (!img) return null;
    if (!stickersRef.current.length) return null;
    const w = img.naturalWidth || CANVAS_W;
    const h = img.naturalHeight || CANVAS_H;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    for (const s of stickersRef.current) {
      const src = await loadStickerImage(s.defId);
      drawSticker(ctx, src, s.x * w, s.y * h, s.size * w, s.rot);
    }
    return c.toDataURL('image/jpeg', 0.92);
  }, []);

  const stillOrPhoto = useCallback(async () => {
    try {
      return (await composeStill()) ?? photoSrc;
    } catch (error) {
      console.warn('still compose failed', error);
      return photoSrc;
    }
  }, [composeStill, photoSrc]);

  const openZoom = async () => {
    if (editing || photoState !== 'ready') return;
    setZoomSrc(await stillOrPhoto());
  };

  const openAr = async () => {
    setEditing(false);
    setSelected(null);
    setArSrc(await stillOrPhoto());
  };

  const triggerDownload = (href: string, name: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadPhoto = async () => {
    try {
      const decorated = await composeStill();
      if (decorated) {
        triggerDownload(decorated, 'ai-hancut-' + meta.id + '-sticker.jpg');
        return;
      }
      const res = await fetch(photoSrc);
      if (!res.ok) throw new Error('photo ' + res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      triggerDownload(url, 'ai-hancut-' + meta.id + '.jpg');
      URL.revokeObjectURL(url);
    } catch {
      window.open(meta.photoUrl, '_blank');
    }
  };

  const downloadLiveVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isRecording) return;
    finishEditing();
    setIsPlaying(true);
    setIsRecording(true);

    try {
      const stream = canvas.captureStream(30);
      const mime = MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        triggerDownload(url, 'ai-hancut-live-' + meta.id + '.' + ext);
        URL.revokeObjectURL(url);
        setIsRecording(false);
      };

      recorder.start();
      playChime();
      setTimeout(() => recorder.stop(), 3200);
    } catch (err) {
      console.error('Video recording failed', err);
      setIsRecording(false);
      alert('동영상 저장을 지원하지 않는 브라우저입니다.');
    }
  };

  const copyLink = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (navigator.share) {
      await navigator.share({
        title: '인천과학대제전 AI한컷 라이브 포토',
        url: window.location.href,
      });
    }
  };

  const group = STICKER_GROUPS.find((g) => g.id === trayGroup) ?? STICKER_GROUPS[0];

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#070b16] px-4 py-6 text-slate-100">
      <header className="flex w-full max-w-md items-center justify-between border-b border-cyan-900/40 pb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8] animate-pulse" />
          <h1 className="text-lg font-bold tracking-tight text-cyan-300">제28회 인천과학대제전</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/50 px-3 py-1 text-xs text-cyan-200 backdrop-blur">
          <Sparkles className="size-3 text-cyan-400" />
          <span>AR LIVE PHOTO</span>
        </div>
      </header>

      <section className="relative my-5 flex w-full max-w-md flex-col items-center">
        {editing && (
          <p className="mb-2 w-full max-w-[360px] rounded-xl bg-cyan-950/60 px-3 py-2 text-center text-xs leading-relaxed text-cyan-100">
            스티커를 눌러 붙이고 끌어서 옮겨요. 파란 손잡이나 두 손가락으로 크기·방향을 바꾸고, 빨간 ✕로 지워요.
          </p>
        )}
        <div
          className={cn(
            'relative aspect-[2/3] w-full max-w-[360px] overflow-hidden rounded-2xl border-2 bg-slate-900 shadow-[0_10px_40px_rgba(6,182,212,0.15)]',
            editing ? 'border-amber-400/80' : 'border-cyan-500/40'
          )}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            aria-label={editing ? '스티커 꾸미기 화면' : '사진을 누르면 크게 볼 수 있어요'}
            className={cn('size-full object-contain', editing ? 'cursor-move touch-none' : 'cursor-zoom-in')}
            onClick={openZoom}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerUp}
          />
          {photoState !== 'ready' && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-cyan-200">
              {photoState === 'loading' ? (
                <>
                  <span className="size-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300" />
                  <span>사진을 불러오는 중이에요</span>
                </>
              ) : (
                <span>사진을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</span>
              )}
            </div>
          )}
          {!editing && (
            <>
              <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-md">
                <span className={'size-2 rounded-full ' + (isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-slate-400')} />
                <span className="font-medium">{isPlaying ? 'LIVE ON' : 'PAUSED'}</span>
              </div>
              <button
                type="button"
                onClick={openZoom}
                className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-md"
              >
                <ZoomIn className="size-3.5" aria-hidden /> 크게 보기
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white backdrop-blur-md transition-opacity hover:opacity-80"
            aria-label={isMuted ? '소리 켜기' : '소리 끄기'}
          >
            {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>

        {editing ? (
          <div className="mt-3 flex w-full max-w-[360px] flex-col gap-2">
            <div role="tablist" aria-label="스티커 종류" className="flex gap-2">
              {STICKER_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={trayGroup === g.id}
                  onClick={() => setTrayGroup(g.id)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-semibold',
                    trayGroup === g.id ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-1.5 rounded-2xl border border-cyan-900/40 bg-slate-900/70 p-2">
              {group.items.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => addSticker(d.id)}
                  aria-label={d.label + ' 스티커 붙이기'}
                  className="flex aspect-square items-center justify-center rounded-xl bg-white/5 p-1 transition-transform active:scale-90 hover:bg-white/10"
                >
                  {d.kind === 'svg' ? (
                    <img src={svgDataUrl(d.svg)} alt="" className="size-full object-contain" draggable={false} />
                  ) : (
                    <span className="text-2xl leading-none">{d.char}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  commitStickers([]);
                  setSelected(null);
                }}
                disabled={!stickers.length}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 py-2.5 text-sm font-semibold text-slate-300 disabled:opacity-40"
              >
                <Trash2 className="size-4" aria-hidden /> 모두 지우기
              </button>
              <button type="button" onClick={finishEditing} className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-slate-950">
                <Check className="size-4" aria-hidden /> 꾸미기 완료
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 grid w-full max-w-[360px] grid-cols-3 gap-2 px-1">
            <button
              type="button"
              onClick={() => {
                setIsPlaying((p) => !p);
                if (!isPlaying) playChime();
              }}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-cyan-500/30 bg-cyan-950/40 py-2.5 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-900/50"
            >
              {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
              <span>{isPlaying ? '일시 정지' : '라이브 재생'}</span>
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={photoState !== 'ready'}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-amber-400/50 bg-amber-500/15 py-2.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/25 disabled:opacity-40"
            >
              <Sticker className="size-5" />
              <span>스티커 꾸미기{stickers.length ? ' (' + stickers.length + ')' : ''}</span>
            </button>
            <button
              type="button"
              onClick={openAr}
              disabled={photoState !== 'ready'}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-fuchsia-400/50 bg-fuchsia-500/15 py-2.5 text-xs font-semibold text-fuchsia-200 transition-colors hover:bg-fuchsia-500/25 disabled:opacity-40"
            >
              <Camera className="size-5" />
              <span>AR 카메라</span>
            </button>
          </div>
        )}
      </section>

      <section className="flex w-full max-w-md flex-col gap-2.5 pt-2">
        <button
          type="button"
          onClick={downloadPhoto}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-cyan-500 py-3.5 text-base font-bold text-slate-950 shadow-[0_4px_20px_rgba(6,182,212,0.3)] transition-transform active:scale-[0.98] hover:bg-cyan-400"
        >
          <Download className="size-5" />
          <span>{stickers.length ? '스티커 사진 저장 (고화질)' : '고화질 인쇄 사진 저장 (4×6)'}</span>
        </button>

        <button
          type="button"
          onClick={downloadLiveVideo}
          disabled={isRecording || photoState !== 'ready'}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-cyan-500/40 bg-slate-900/90 py-3.5 text-base font-bold text-cyan-300 transition-all active:scale-[0.98] hover:bg-slate-800 disabled:opacity-50"
        >
          <Video className="size-5 text-cyan-400" />
          <span>{isRecording ? '영상 생성 중...' : '움직이는 라이브 영상 저장 (WebM/MP4)'}</span>
        </button>

        <button
          type="button"
          onClick={copyLink}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/50 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          {copied ? <Check className="size-4 text-emerald-400" /> : <Share2 className="size-4" />}
          <span>{copied ? '링크가 복사되었습니다!' : '친구들에게 링크 공유하기'}</span>
        </button>
      </section>

      <footer className="mt-8 flex w-full max-w-md flex-col gap-2 rounded-2xl border border-cyan-900/30 bg-slate-900/40 p-4 text-xs text-slate-400">
        <div className="flex items-center gap-2 font-semibold text-cyan-300">
          <Eye className="size-4 text-cyan-400" />
          <span>AR 라이브 포토 즐기는 팁</span>
        </div>
        <p className="leading-relaxed">• 사진을 누르면 크게 볼 수 있어요. 두 손가락으로 더 확대할 수 있어요.</p>
        <p className="leading-relaxed">
          • <strong>[스티커 꾸미기]</strong>로 과학 스티커와 이모지를 붙여 보세요. 꾸민 사진은 저장하는 사진과 라이브 영상에도 그대로 들어가요.
        </p>
        <p className="leading-relaxed">
          • <strong>[AR 카메라]</strong>를 켜고 얼굴을 비추면 우주 헬멧, 아인슈타인 머리, 행성 왕관 같은 AR 효과가 얼굴을 따라다녀요. 내 AI 사진을 홀로그램으로 띄워 함께 찍을 수도 있어요.
        </p>
      </footer>

      {zoomSrc && <PhotoZoom src={zoomSrc} alt="AI한컷 사진 크게 보기" onClose={() => setZoomSrc(null)} />}
      {arSrc && <ArCamera photoSrc={arSrc} backgroundId={meta.backgroundId} onClose={() => setArSrc(null)} />}
    </main>
  );
}

/** Dashed frame with a red delete button (top right) and a blue resize/rotate handle (bottom right). */
function drawSelection(ctx: CanvasRenderingContext2D, s: PlacedSticker) {
  const c = centerOf(s);
  const half = (s.size * CANVAS_W) / 2;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(s.rot);
  ctx.setLineDash([12, 9]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 216, 77, 0.95)';
  ctx.strokeRect(-half, -half, half * 2, half * 2);
  ctx.setLineDash([]);
  const knob = (x: number, y: number, fill: string) => {
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  };
  knob(half, -half, '#ff5a6e');
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(half - 9, -half - 9);
  ctx.lineTo(half + 9, -half + 9);
  ctx.moveTo(half + 9, -half - 9);
  ctx.lineTo(half - 9, -half + 9);
  ctx.stroke();
  knob(half, half, '#38bdf8');
  ctx.beginPath();
  ctx.arc(half, half, 11, -Math.PI * 0.1, Math.PI * 1.3);
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
}
