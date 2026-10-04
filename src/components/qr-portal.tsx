'use client';

import { useEffect, useRef, useState } from 'react';
import type { TransferState } from '@/lib/transfer/client';
import type { MagicTreeScene, ViewMode } from '@/lib/magic-tree';
import styles from './qr-portal.module.css';

export function warmQrPortal() {
  void import('@/lib/magic-tree').catch(() => {});
}

/** Magic Tree QR: the tree is the default view and tapping settles it into the scannable code. */
export function QrPortal({ url, dataUrl, state }: { url: string; dataUrl: string; state: TransferState }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLButtonElement>(null);
  const scene = useRef<MagicTreeScene | null>(null);
  const [mode, setMode] = useState<ViewMode>('tree');
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [settled, setSettled] = useState<ViewMode>('tree');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const scroll = requestAnimationFrame(() => stage.current?.scrollIntoView({ block: 'center', behavior: 'auto' }));
    return () => cancelAnimationFrame(scroll);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setReady(false); setFailed(false);
    const fail = () => { if (!cancelled) { scene.current = null; setFailed(true); setReady(false); } };
    import('@/lib/magic-tree').then(({ MagicTreeScene }) => {
      if (cancelled || !canvas.current) return;
      scene.current = new MagicTreeScene(canvas.current, url, {
        mode: modeRef.current, errorCorrectionLevel: 'M',
        onSettled: value => { if (!cancelled) { setSettled(value); setReady(true); } }, onFailed: fail,
      });
    }).catch(fail);
    return () => { cancelled = true; scene.current?.dispose(); scene.current = null; };
  }, [url, attempt]);
  useEffect(() => { scene.current?.setMode(mode); }, [mode]);
  const showTree = ready && !failed;
  const toggle = () => {
    if (failed) { setMode('tree'); setAttempt(n => n + 1); }
    else setMode(value => value === 'tree' ? 'code' : 'tree');
  };
  const label = failed ? '3D 다시 시도' : mode === 'tree' ? 'QR 코드 보기' : '나무 다시 보기';
  return <div className="flex w-full flex-col items-center gap-2">
    <button ref={stage} type="button" onClick={toggle} aria-label={label} className={`${styles.stage} ${showTree ? styles.tree : styles.plain}`} data-status={state.status} data-testid="qr-portal" data-mode={failed ? 'fallback' : mode} data-rendered={failed ? 'fallback' : !ready ? 'loading' : mode !== settled ? 'transition' : settled}>
      <img src={dataUrl} alt="AR 라이브 포토 QR 코드" className={styles.qr} width={512} height={512} />
      <canvas key={attempt} ref={canvas} className={styles.canvas} aria-hidden />
    </button>
    <button type="button" className={styles.toggle} onClick={toggle}>{label}</button>
    <p className="text-xs text-cyan-100/80">{failed ? '3D를 표시할 수 없어 기본 QR을 보여 드려요.' : !ready ? '나무를 준비하고 있어요. 지금 보이는 QR도 바로 스캔할 수 있어요.' : mode === 'tree' ? '나무를 누르면 잎이 내려앉아 QR 코드가 돼요.' : '휴대폰 카메라로 비춰 주세요. 다시 누르면 나무로 돌아가요.'}</p>
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
