'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Download, Home, Loader2, Printer, RotateCcw, Sparkles } from 'lucide-react';
import { uploadForQrAction } from '@/app/actions';
import { DEFAULT_FRAME_ID, FRAMES, findFrame, frameThumbUrl } from '@/lib/frames';
import { composePrint, downloadDataUrl, printPhoto } from '@/lib/image';
import { cn } from '@/lib/utils';

const AUTO_RESTART_SECONDS = 60;

type Props = {
  image: string;
  onRestart: () => void;
  onRetry: () => void;
};

type QrState = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; dataUrl: string } | { status: 'error'; message: string };

export function ResultView({ image, onRestart, onRetry }: Props) {
  const [frameId, setFrameId] = useState(DEFAULT_FRAME_ID);
  // Finished prints per frame, so switching back and forth is instant.
  const [prints, setPrints] = useState<Record<string, string>>({});
  const [qr, setQr] = useState<QrState>({ status: 'idle' });
  const [left, setLeft] = useState(AUTO_RESTART_SECONDS);
  const restartRef = useRef(onRestart);
  restartRef.current = onRestart;

  const framed = prints[frameId] ?? null;

  useEffect(() => {
    setPrints({});
  }, [image]);

  useEffect(() => {
    if (prints[frameId]) return;
    let cancelled = false;
    composePrint(image, findFrame(frameId))
      .then((url) => !cancelled && setPrints((p) => ({ ...p, [frameId]: url })))
      .catch((error) => {
        console.error('frame compose failed', error);
        if (!cancelled) setPrints((p) => ({ ...p, [frameId]: image }));
      });
    return () => {
      cancelled = true;
    };
  }, [image, frameId, prints]);

  useEffect(() => {
    if (left <= 0) {
      restartRef.current();
      return;
    }
    const timer = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  // Any interaction gives the visitor more time before the booth resets.
  const keepAlive = () => setLeft(AUTO_RESTART_SECONDS);

  const chooseFrame = (id: string) => {
    keepAlive();
    setFrameId(id);
    // A QR code points at one uploaded print; a new frame needs a new upload.
    setQr({ status: 'idle' });
  };

  const download = async () => {
    keepAlive();
    if (framed) await downloadDataUrl(framed, 'ai-hancut-' + frameId + '-' + Date.now() + '.jpg');
  };

  const print = async () => {
    keepAlive();
    if (framed) await printPhoto(framed).catch((error) => console.error('print failed', error));
  };

  const makeQr = async () => {
    keepAlive();
    if (!framed || qr.status === 'loading' || qr.status === 'ready') return;
    setQr({ status: 'loading' });
    const uploaded = await uploadForQrAction(framed, { frameId });
    if (!uploaded.ok) {
      setQr({ status: 'error', message: uploaded.error });
      return;
    }
    const dataUrl = await QRCode.toDataURL(uploaded.url, { width: 320, margin: 1, errorCorrectionLevel: 'M' });
    setQr({ status: 'ready', dataUrl });
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto overscroll-contain lg:flex-row lg:items-stretch lg:justify-center lg:gap-10 lg:overflow-visible"
      onPointerDown={keepAlive}
    >
      {/* Phones scroll this column; the photo keeps its own height instead of shrinking under the picker. */}
      <div className="relative flex shrink-0 items-center justify-center lg:min-h-0 lg:shrink">
        {framed ? (
          <img
            key={frameId}
            src={framed}
            alt={'완성된 AI 사진, ' + findFrame(frameId).name + ' 프레임'}
            className="aspect-[2/3] h-[min(calc(100dvh-14rem),calc((100vw-2rem)*1.5))] w-auto max-w-full rounded-lg shadow-2xl animate-rise lg:h-auto lg:max-h-[calc(100dvh-8rem)]"
          />
        ) : (
          <div className="flex aspect-[2/3] h-[min(calc(100dvh-14rem),calc((100vw-2rem)*1.5))] max-w-full items-center justify-center rounded-lg bg-white/5 lg:h-[calc(100dvh-8rem)]">
            <Loader2 className="size-10 animate-spin text-muted-foreground" aria-label="프레임 입히는 중" />
          </div>
        )}
      </div>

      <div className="flex w-full max-w-md flex-col justify-center gap-4">
        <h2 className="text-center font-display text-5xl text-primary">완성!</h2>

        <section aria-labelledby="frame-title" className="flex flex-col gap-2">
          <h3 id="frame-title" className="font-display text-xl text-foreground">
            프레임 고르기
          </h3>
          <div role="radiogroup" aria-labelledby="frame-title" className="grid grid-cols-5 gap-2">
            {FRAMES.map((f) => {
              const active = f.id === frameId;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => chooseFrame(f.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl p-1 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 active:scale-95',
                    active ? 'bg-primary/15' : 'hover:bg-white/5'
                  )}
                >
                  <span className={cn('relative block w-full overflow-hidden rounded-md border-2 bg-slate-400', active ? 'border-primary' : 'border-transparent')}>
                    <img src={frameThumbUrl(f.id)} alt="" width={240} height={360} loading="lazy" decoding="async" draggable={false} className="block aspect-[2/3] w-full" />
                    {active && (
                      <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-4" aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className={cn('text-xs leading-tight', active ? 'text-primary' : 'text-muted-foreground')}>{f.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn-primary w-full py-4 text-2xl" onClick={print} disabled={!framed}>
            <Printer className="size-6" aria-hidden /> 인쇄
          </button>
          <button type="button" className="btn-primary w-full py-4 text-2xl" onClick={download} disabled={!framed}>
            <Download className="size-6" aria-hidden /> 저장
          </button>
        </div>
        <button type="button" className="btn-accent w-full flex items-center justify-center gap-2" onClick={makeQr} disabled={!framed || qr.status === 'loading'}>
          {qr.status === 'loading' ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Sparkles className="size-5 text-amber-300" aria-hidden />}
          AR 라이브 포토 받기 (QR)
        </button>
        {qr.status === 'ready' && (
          <div className="panel flex flex-col items-center gap-2 p-4 animate-rise text-center">
            <img src={qr.dataUrl} alt="AR 라이브 포토 QR 코드" className="size-48 rounded-xl bg-white p-2" />
            <p className="text-sm font-semibold text-primary">스마트폰 카메라로 비춰보세요</p>
            <p className="text-xs text-muted-foreground">사진이 살아서 움직이는 AR 라이브 포토가 열립니다</p>
          </div>
        )}
        {qr.status === 'error' && (
          <p role="alert" className="text-center text-sm text-destructive">
            {qr.message}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn-ghost text-lg" onClick={onRetry}>
            <RotateCcw className="size-5" aria-hidden /> 다시 고르기
          </button>
          <button type="button" className="btn-ghost text-lg" onClick={onRestart}>
            <Home className="size-5" aria-hidden /> 처음으로
          </button>
        </div>
        <div className="space-y-1" aria-live="off">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full origin-left bg-primary transition-transform duration-1000 ease-linear"
              style={{ transform: 'scaleX(' + left / AUTO_RESTART_SECONDS + ')' }}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">{left}초 뒤 처음 화면으로 돌아가요</p>
        </div>
      </div>
    </div>
  );
}
