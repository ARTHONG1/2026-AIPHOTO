'use client';

import { useEffect, useRef, useState } from 'react';
import type { TransferState } from '@/lib/transfer/client';
import type { PortalMode, PortalScene } from '@/lib/qr-portal-renderer';
import styles from './qr-portal.module.css';

export function warmQrPortal() {
  void import('@/lib/qr-portal-renderer').catch(() => {});
}

export function QrPortal({ url, dataUrl, state }: { url: string; dataUrl: string; state: TransferState }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLButtonElement>(null);
  const scene = useRef<PortalScene | null>(null);
  const [mode, setMode] = useState<PortalMode>('3d');
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [settled, setSettled] = useState<PortalMode>('3d');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update);
    const scroll = requestAnimationFrame(() => stage.current?.scrollIntoView({ block: 'center', behavior: 'auto' }));
    return () => { media.removeEventListener('change', update); cancelAnimationFrame(scroll); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setReady(false); setFailed(false);
    const fail = () => { if (!cancelled) { setFailed(true); setReady(false); } };
    import('@/lib/qr-portal-renderer').then(({ createQrPortalScene }) => {
      if (cancelled || !canvas.current) return;
      scene.current = createQrPortalScene(canvas.current, url, {
        mode: modeRef.current, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        settled: value => { if (!cancelled) { setSettled(value); setReady(true); } }, failed: fail,
      });
    }).catch(fail);
    return () => { cancelled = true; scene.current?.dispose(); scene.current = null; };
  }, [url, attempt]);
  useEffect(() => { scene.current?.setMode(mode, reduced); }, [mode, reduced]);
  const flat = failed || (mode === 'flat' && (!ready || settled === 'flat'));
  const showCanvas = ready && !flat;
  const toggle = () => {
    if (failed) { setMode('3d'); setAttempt(n => n + 1); }
    else setMode(value => value === '3d' ? 'flat' : '3d');
  };
  const label = failed ? '3D 다시 시도' : mode === '3d' ? '스캔용 QR 보기' : '3D QR로 돌아가기';
  return <div className="flex w-full flex-col items-center gap-2">
    <button ref={stage} type="button" onClick={toggle} aria-label={label} className={`${styles.stage} ${showCanvas ? styles.sculpture : ''} ${flat ? styles.plain : ''}`} data-status={state.status} data-testid="qr-portal" data-mode={failed ? 'fallback' : mode} data-rendered={failed ? 'fallback' : !ready ? 'loading' : mode !== settled ? 'transition' : settled}>
      <div className={styles.ring} aria-hidden />
      <div className={styles.orbit} aria-hidden />
      <img src={dataUrl} alt="AR 라이브 포토 QR 코드" className={styles.qr} width={512} height={512} />
      <canvas key={attempt} ref={canvas} className={styles.canvas} aria-hidden />
    </button>
    <button type="button" className={styles.toggle} onClick={toggle}>{label}</button>
    <p className="text-xs text-cyan-100/80">{failed ? '3D를 표시할 수 없어 기본 QR을 보여 드려요.' : !ready && mode === '3d' ? '3D QR을 준비하고 있어요. 스캔용 QR은 바로 열 수 있어요.' : mode === '3d' ? '입체 QR을 누르면 스캔하기 쉬운 QR로 바뀌어요.' : '휴대폰 카메라로 비춰 주세요. 다시 누르면 입체 QR로 돌아가요.'}</p>
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
