'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, X } from 'lucide-react';

type Props = { src: string; alt: string; onClose: () => void };
type View = { scale: number; x: number; y: number };
type Pt = { x: number; y: number };
type Gesture =
  | { kind: 'pan'; px: number; py: number; x: number; y: number }
  | { kind: 'pinch'; dist: number; mx: number; my: number; view: View };

const MAX_SCALE = 5;
const TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 320;
const FULL: View = { scale: 1, x: 0, y: 0 };

/** Full-screen photo viewer: pinch, double tap, mouse wheel and +/- to zoom, drag to pan. */
export function PhotoZoom({ src, alt, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>(FULL);
  const [active, setActive] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture | null>(null);
  const tap = useRef({ time: 0, x: 0, y: 0, moved: false, sx: 0, sy: 0 });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const clamp = useCallback((v: View): View => {
    const scale = Math.min(MAX_SCALE, Math.max(1, v.scale));
    const img = imgRef.current;
    if (!img || scale === 1) return { scale, x: 0, y: 0 };
    const maxX = (img.offsetWidth * (scale - 1)) / 2;
    const maxY = (img.offsetHeight * (scale - 1)) / 2;
    return { scale, x: Math.max(-maxX, Math.min(maxX, v.x)), y: Math.max(-maxY, Math.min(maxY, v.y)) };
  }, []);

  // Keeps the point p (relative to the stage centre) still while the scale changes.
  const zoomAt = useCallback(
    (p: Pt, scale: number, from: View = viewRef.current): View => {
      const s = Math.min(MAX_SCALE, Math.max(1, scale));
      const k = s / from.scale;
      return clamp({ scale: s, x: p.x - (p.x - from.x) * k, y: p.y - (p.y - from.y) * k });
    },
    [clamp]
  );

  const local = (clientX: number, clientY: number): Pt => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  };

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const v = viewRef.current;
    if (pts.length >= 2) {
      const [a, b] = pts;
      gesture.current = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, view: v };
    } else if (pts.length === 1) {
      gesture.current = { kind: 'pan', px: pts[0].x, py: pts[0].y, x: v.x, y: v.y };
    } else {
      gesture.current = null;
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) tap.current = { ...tap.current, moved: false, sx: p.x, sy: p.y };
    else tap.current.moved = true;
    setActive(true);
    startGesture();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const zoomed = zoomAt({ x: g.mx, y: g.my }, g.view.scale * (dist / g.dist), g.view);
      setView(clamp({ ...zoomed, x: zoomed.x + mid.x - g.mx, y: zoomed.y + mid.y - g.my }));
    } else {
      const dx = p.x - g.px;
      const dy = p.y - g.py;
      if (Math.hypot(p.x - tap.current.sx, p.y - tap.current.sy) > 8) tap.current.moved = true;
      setView((v) => clamp({ ...v, x: g.x + dx, y: g.y + dy }));
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = pointers.current.get(e.pointerId)!;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      setActive(false);
      const t = tap.current;
      if (!t.moved) {
        const now = performance.now();
        if (now - t.time < DOUBLE_TAP_MS && Math.hypot(p.x - t.x, p.y - t.y) < 40) {
          setView((v) => (v.scale > 1.05 ? FULL : zoomAt(p, TAP_ZOOM, v)));
          tap.current.time = 0;
        } else {
          tap.current = { ...t, time: now, x: p.x, y: p.y };
        }
      }
    }
    startGesture();
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const p = local(e.clientX, e.clientY);
    setView((v) => zoomAt(p, v.scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2), v));
  };

  const step = (factor: number) => setView((v) => zoomAt({ x: 0, y: 0 }, v.scale * factor, v));

  if (!mounted) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="사진 크게 보기" className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className="absolute left-1/2 top-1/2 max-h-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] rounded-lg shadow-2xl"
          style={{
            transform: 'translate(-50%, -50%) translate(' + view.x + 'px, ' + view.y + 'px) scale(' + view.scale + ')',
            transition: active ? 'none' : 'transform 0.18s ease-out',
          }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-4 flex size-12 items-center justify-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25"
        >
          <X className="size-6" aria-hidden />
        </button>
      </div>
      <div className="flex items-center justify-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <button type="button" onClick={() => step(1 / 1.5)} disabled={view.scale <= 1} aria-label="축소" className="flex size-12 items-center justify-center rounded-full bg-white/15 disabled:opacity-40">
          <Minus className="size-6" aria-hidden />
        </button>
        <span className="w-16 text-center text-sm tabular-nums text-white/80">{Math.round(view.scale * 100)}%</span>
        <button type="button" onClick={() => step(1.5)} disabled={view.scale >= MAX_SCALE} aria-label="확대" className="flex size-12 items-center justify-center rounded-full bg-white/15 disabled:opacity-40">
          <Plus className="size-6" aria-hidden />
        </button>
        <p className="ml-2 hidden text-sm text-white/60 sm:block">두 번 탭하거나 두 손가락으로 확대해요</p>
      </div>
    </div>,
    document.body
  );
}
