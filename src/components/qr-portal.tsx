'use client';

import { useEffect, useRef, useState } from 'react';
import type { TransferState } from '@/lib/transfer/client';
import styles from './qr-portal.module.css';

export function warmQrPortal() {
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) void import('@/lib/qr-portal-scene').catch(() => {});
}

export function QrPortal({ url, dataUrl, state }: { url: string; dataUrl: string; state: TransferState }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [intro, setIntro] = useState(false);
  const [plain, setPlain] = useState(false);
  useEffect(() => {
    setIntro(false);
    if (plain || state.status !== 'waiting' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    const start = performance.now();
    const finish = () => { if (!cancelled) setIntro(false); };
    // Module loading or GPU delays can never keep the real QR covered.
    const deadline = setTimeout(() => { cancelled = true; stop?.(); setIntro(false); }, 2200);
    import('@/lib/qr-portal-scene').then(({ startQrPortalIntro }) => {
      if (cancelled || !canvas.current || performance.now() - start > 600) return;
      stop = startQrPortalIntro(canvas.current, url, () => { if (!cancelled) setIntro(true); }, finish);
    }).catch(finish);
    return () => { cancelled = true; clearTimeout(deadline); stop?.(); };
  }, [url, plain, state.status]);
  return <div className="flex w-full flex-col items-center gap-2">
    <div className={`${styles.stage} ${intro ? styles.intro : ''} ${plain ? styles.plain : ''}`} data-status={state.status} data-testid="qr-portal" data-intro={intro}>
      <div className={styles.ring} aria-hidden />
      <div className={styles.orbit} aria-hidden />
      <img src={dataUrl} alt="AR 라이브 포토 QR 코드" className={styles.qr} width={512} height={512} />
      <canvas ref={canvas} className={styles.canvas} aria-hidden />
    </div>
    <button type="button" className={styles.toggle} onClick={() => setPlain(true)} disabled={plain}>{plain ? '기본 QR 표시 중' : '기본 QR 보기'}</button>
  </div>;
}

export function TransferPortalProgress({ state, compact = false }: { state: TransferState; compact?: boolean }) {
  const complete = state.status === 'received';
  const sending = state.status === 'sending';
  const progress = complete ? 100 : sending ? Math.max(0, Math.min(99, state.progress ?? 0)) : 0;
  return <div className={`${styles.progress} ${compact ? styles.compact : ''}`} aria-hidden>
    <svg viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="51" stroke="#164e63" strokeWidth="3" />
      <circle cx="60" cy="60" r="51" stroke={complete ? '#6ee7b7' : '#67e8f9'} strokeWidth="4" pathLength="100" strokeDasharray={`${progress} 100`} strokeLinecap="round" />
      <circle cx="60" cy="60" r="43" stroke="#67e8f933" strokeDasharray="2 7" />
    </svg>
    <div className={styles.value}><strong>{complete ? '✓' : sending ? `${progress}%` : state.status === 'error' ? '!' : '···'}</strong><span>{complete ? '사진 도착' : sending ? '사진 받는 중' : state.status === 'error' ? '다시 연결' : '연결 중'}</span></div>
  </div>;
}
