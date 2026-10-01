'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Eye, Home, Loader2, QrCode, RotateCcw, Smartphone } from 'lucide-react';
import { uploadForQrAction } from '@/app/actions';
import { composeFrame, downloadDataUrl } from '@/lib/image';
import { cn } from '@/lib/utils';

const AUTO_RESTART_SECONDS = 60;

type Props = {
  image: string;
  /** The captured photo, shown while the visitor holds the compare button. */
  original: string;
  /** Picked presets, e.g. "산호초 · 우주 유영 · 과학 히어로 망토". */
  summary: string;
  onRestart: () => void;
  onRetry: () => void;
};

type QrState = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; dataUrl: string } | { status: 'error'; message: string };

export function ResultView({ image, original, summary, onRestart, onRetry }: Props) {
  const [framed, setFramed] = useState<string | null>(null);
  const [qr, setQr] = useState<QrState>({ status: 'idle' });
  const [left, setLeft] = useState(AUTO_RESTART_SECONDS);
  const [comparing, setComparing] = useState(false);
  const [saved, setSaved] = useState(false);
  const restartRef = useRef(onRestart);
  restartRef.current = onRestart;

  useEffect(() => {
    let cancelled = false;
    composeFrame(image)
      .then((url) => !cancelled && setFramed(url))
      .catch(() => !cancelled && setFramed(image));
    return () => {
      cancelled = true;
    };
  }, [image]);

  // While a QR code is on screen the visitor is busy with their phone, so the reset waits.
  const paused = qr.status === 'ready' || qr.status === 'loading';
  useEffect(() => {
    if (paused) return;
    if (left <= 0) {
      restartRef.current();
      return;
    }
    const timer = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, paused]);

  // Any interaction gives the visitor more time before the booth resets.
  const keepAlive = () => setLeft(AUTO_RESTART_SECONDS);

  const download = async () => {
    keepAlive();
    await downloadDataUrl(framed ?? image, 'ai-hancut-' + Date.now() + '.jpg');
    setSaved(true);
  };

  const makeQr = async () => {
    keepAlive();
    if (qr.status === 'loading' || qr.status === 'ready') return;
    setQr({ status: 'loading' });
    const uploaded = await uploadForQrAction(framed ?? image);
    if (!uploaded.ok) {
      setQr({ status: 'error', message: uploaded.error });
      return;
    }
    const dataUrl = await QRCode.toDataURL(uploaded.url, { width: 360, margin: 1, errorCorrectionLevel: 'M' });
    setQr({ status: 'ready', dataUrl });
  };

  const hold = {
    onPointerDown: () => setComparing(true),
    onPointerUp: () => setComparing(false),
    onPointerLeave: () => setComparing(false),
    onPointerCancel: () => setComparing(false),
    onKeyDown: (e: React.KeyboardEvent) => (e.key === ' ' || e.key === 'Enter') && setComparing(true),
    onKeyUp: () => setComparing(false),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-5 lg:flex-row lg:items-stretch lg:justify-center lg:gap-12" onPointerDown={keepAlive}>
      <div className="relative flex min-h-0 flex-1 items-center justify-center lg:flex-none">
        <div aria-hidden className="absolute inset-[8%] rounded-[3rem] bg-gradient-to-br from-primary/40 via-[#ff7ad9]/30 to-accent/40 blur-3xl" />
        <div className="relative animate-[result-in_0.7s_cubic-bezier(0.2,1.2,0.4,1)_both]">
          <img
            src={framed ?? image}
            alt="완성된 AI 사진"
            className={cn(
              'max-h-[calc(100dvh-17rem)] w-auto max-w-full rounded-3xl shadow-2xl transition-opacity duration-200 lg:max-h-[calc(100dvh-4rem)]',
              comparing && 'opacity-0'
            )}
          />
          {/* Original photo cross-fades in while the compare button is held. */}
          <img
            src={original}
            alt=""
            aria-hidden
            className={cn('absolute inset-0 m-auto size-full rounded-3xl object-cover transition-opacity duration-200', comparing ? 'opacity-100' : 'opacity-0')}
          />
          {comparing && <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 font-display text-lg text-white">원래 사진</span>}
        </div>
      </div>

      <div className="flex w-full max-w-md flex-col justify-center gap-4">
        <div className="text-center lg:text-left">
          <p className="font-display text-6xl text-primary drop-shadow-[0_0_24px_hsl(48_100%_62%/0.5)]">완성!</p>
          {summary && <p className="mt-1 text-lg text-muted-foreground">{summary}</p>}
        </div>

        {qr.status === 'ready' ? (
          <div className="panel flex items-center gap-5 p-5 animate-rise">
            <img src={qr.dataUrl} alt="사진 받기 QR 코드" className="size-40 shrink-0 rounded-2xl bg-white p-2" />
            <div className="space-y-2">
              <p className="flex items-center gap-2 font-display text-2xl">
                <Smartphone className="size-6 text-accent" aria-hidden /> 휴대폰으로 받기
              </p>
              <p className="text-muted-foreground">카메라 앱으로 QR 코드를 비추면 사진이 열려요.</p>
              <button type="button" className="text-sm text-accent underline-offset-4 hover:underline" onClick={() => setQr({ status: 'idle' })}>
                QR 닫기
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <button type="button" className="btn-primary min-h-16 w-full text-2xl" onClick={download}>
              <Download className="size-7" aria-hidden /> {saved ? '한 번 더 저장' : '사진 저장하기'}
            </button>
            <button type="button" className="btn-accent min-h-14 w-full" onClick={makeQr} disabled={qr.status === 'loading'}>
              {qr.status === 'loading' ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <QrCode className="size-6" aria-hidden />}
              {qr.status === 'loading' ? 'QR 만드는 중…' : '휴대폰으로 받기'}
            </button>
            {qr.status === 'error' && (
              <p role="alert" className="text-center text-sm text-destructive">
                {qr.message}
              </p>
            )}
          </div>
        )}

        <button type="button" className="btn-ghost min-h-12 w-full select-none" aria-label="누르고 있으면 원래 사진이 보여요" {...hold}>
          <Eye className="size-5" aria-hidden /> 누르고 있으면 원래 사진
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn-ghost min-h-12 text-lg" onClick={onRetry}>
            <RotateCcw className="size-5" aria-hidden /> 다른 조합
          </button>
          <button type="button" className="btn-ghost min-h-12 text-lg" onClick={onRestart}>
            <Home className="size-5" aria-hidden /> 다음 사람
          </button>
        </div>

        <div className="space-y-1.5" aria-live="off">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn('h-full origin-left bg-primary/80 transition-transform duration-1000 ease-linear', paused && 'bg-accent/80')}
              style={{ transform: 'scaleX(' + left / AUTO_RESTART_SECONDS + ')' }}
            />
          </div>
          <p className="text-center text-sm text-muted-foreground">{paused ? 'QR 코드를 보는 동안 기다릴게요' : left + '초 뒤 처음 화면으로 돌아가요 · 화면을 누르면 연장'}</p>
        </div>
      </div>
    </div>
  );
}
