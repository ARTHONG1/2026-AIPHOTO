'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = { before: string; after: string; className?: string };

/**
 * Before/after slider. Both photos fill the same 4:5 box: the AI result is 4:5
 * already, and the 2:3 original is cropped for display only, trimming less from
 * the top so a head near the edge stays in view. Nothing here is saved.
 */
export function BeforeAfter({ before, after, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [pos, setPos] = useState(50);
  const moveTo = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (rect && rect.width) setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    moveTo(event.clientX);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => { if (dragging.current) moveTo(event.clientX); };
  const up = () => { dragging.current = false; };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 20 : 5;
    const next = event.key === 'ArrowLeft' ? pos - step : event.key === 'ArrowRight' ? pos + step : event.key === 'Home' ? 0 : event.key === 'End' ? 100 : null;
    if (next === null) return;
    event.preventDefault();
    setPos(Math.min(100, Math.max(0, next)));
  };
  return (
    <div
      ref={box}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      data-testid="before-after"
      className={cn('relative aspect-[4/5] cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-lg bg-black shadow-2xl', className)}
    >
      <img src={after} alt="변신 후 AI 사진" draggable={false} className="pointer-events-none absolute inset-0 size-full object-cover" />
      <img
        src={before}
        alt="변신 전 원본 사진"
        draggable={false}
        className="pointer-events-none absolute inset-0 size-full object-cover"
        style={{ objectPosition: '50% 25%', clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <span className={cn('pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-lg border border-white/80 bg-black/55 px-3 py-2 text-sm font-bold text-white backdrop-blur transition-opacity', pos < 18 && 'opacity-0')}>변신 전</span>
      <span className={cn('pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-white/80 bg-black/55 px-3 py-2 text-sm font-bold text-white backdrop-blur transition-opacity', pos > 82 && 'opacity-0')}>변신 후</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]" style={{ left: pos + '%' }} />
      <div
        role="slider"
        tabIndex={0}
        aria-label="변신 전후 비교"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`변신 전 ${Math.round(pos)}%, 변신 후 ${100 - Math.round(pos)}%`}
        onKeyDown={key}
        className="absolute top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/45 text-white shadow-lg backdrop-blur focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/70"
        style={{ left: pos + '%' }}
      >
        <ChevronLeft className="-mr-1 size-5" aria-hidden />
        <ChevronRight className="-ml-1 size-5" aria-hidden />
      </div>
    </div>
  );
}
