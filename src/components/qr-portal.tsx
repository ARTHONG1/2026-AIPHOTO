'use client';

import { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Maximize2, ShieldCheck, X } from 'lucide-react';
import type { TransferState } from '@/lib/transfer/client';
import type { MagicTreeScene, ViewMode } from '@/lib/magic-tree';
import { cn } from '@/lib/utils';
import styles from './qr-portal.module.css';

export function warmQrPortal() {
  void import('@/lib/magic-tree').catch(() => {});
}

const statusText = (state: TransferState) =>
  state.status === 'received' ? '휴대폰에 사진을 전달했어요!'
  : state.status === 'sending' ? `사진 전달 중 (${state.progress ?? 0}%)`
  : state.status === 'connecting' ? '휴대폰과 연결 중이에요'
  : state.status === 'error' ? state.message || '연결이 끊겼어요. QR을 다시 만들어 주세요.'
  : '스마트폰 카메라로 비춰보세요';

/**
 * Magic Tree QR. Like the original page, the tree opens full screen with the QR
 * plot under it; tapping settles the leaves into the scannable code. Closing
 * leaves a smaller tree in the result panel. Only one WebGL scene runs at a time.
 */
export function QrPortal({ url, dataUrl, state }: { url: string; dataUrl: string; state: TransferState }) {
  const [mode, setMode] = useState<ViewMode>('tree');
  const [big, setBig] = useState(true);
  return <div className="flex w-full flex-col items-center gap-2">
    {!big && <TreeStage url={url} dataUrl={dataUrl} status={state.status} mode={mode} setMode={setMode} />}
    {!big && <button type="button" className={styles.toggle} onClick={() => setBig(true)}><Maximize2 className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />QR 나무 크게 보기</button>}
    <DialogPrimitive.Root open={big} onOpenChange={setBig}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className={styles.overlay} onOpenAutoFocus={event => event.preventDefault()}>
          <DialogPrimitive.Title className="sr-only">QR 나무</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">나무를 누르면 휴대폰 카메라로 스캔할 QR 코드가 나와요.</DialogPrimitive.Description>
          <div className={styles.bar}>
            {/* Visual only: the result panel's live region keeps announcing while this view is open. */}
            <span className={styles.chip} data-status={state.status}>{statusText(state)}</span>
            <DialogPrimitive.Close className={styles.close}><X className="size-4" aria-hidden />닫기</DialogPrimitive.Close>
          </div>
          <TreeStage full url={url} dataUrl={dataUrl} status={state.status} mode={mode} setMode={setMode} />
          <p className={styles.privacy}><ShieldCheck className="size-4 shrink-0" aria-hidden />QR로 전달하는 사진은 외부 서버에 저장하지 않아요. QR에는 연결 정보만 담겨 있어요.</p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  </div>;
}

/** One Magic Tree canvas with its own WebGL scene; the flat QR image covers loading and failures. */
function TreeStage({ url, dataUrl, status, mode, setMode, full = false }: {
  url: string; dataUrl: string; status: TransferState['status']; mode: ViewMode; setMode: (mode: ViewMode) => void; full?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLButtonElement>(null);
  const scene = useRef<MagicTreeScene | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [settled, setSettled] = useState<ViewMode>(mode);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (full) { stage.current?.focus({ preventScroll: true }); return; }
    const scroll = requestAnimationFrame(() => stage.current?.scrollIntoView({ block: 'center', behavior: 'auto' }));
    return () => cancelAnimationFrame(scroll);
  }, [full]);
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
    else setMode(mode === 'tree' ? 'code' : 'tree');
  };
  const label = failed ? '3D 다시 시도' : mode === 'tree' ? 'QR 코드 보기' : '나무 다시 보기';
  const pill = failed ? '3D 다시 시도' : !ready ? '나무를 키우고 있어요' : mode === 'tree' ? '나무를 누르면 QR 코드가 나와요' : '휴대폰 카메라로 비춰 주세요 · 누르면 나무로 돌아가요';
  return <>
    <button ref={stage} type="button" onClick={toggle} aria-label={label} className={cn(styles.stage, full && styles.full, showTree ? styles.tree : styles.plain)} data-status={status} data-testid="qr-portal" data-view={full ? 'full' : 'card'} data-mode={failed ? 'fallback' : mode} data-rendered={failed ? 'fallback' : !ready ? 'loading' : mode !== settled ? 'transition' : settled}>
      <img src={dataUrl} alt="AR 라이브 포토 QR 코드" className={styles.qr} width={512} height={512} />
      <canvas key={attempt} ref={canvas} className={styles.canvas} aria-hidden />
    </button>
    {full
      ? <button type="button" className={styles.hint} onClick={toggle}>{pill}</button>
      : <>
        <button type="button" className={styles.toggle} onClick={toggle}>{label}</button>
        <p className="text-xs text-cyan-100/80">{failed ? '3D를 표시할 수 없어 기본 QR을 보여 드려요.' : !ready ? '나무를 준비하고 있어요. 지금 보이는 QR도 바로 스캔할 수 있어요.' : mode === 'tree' ? '나무를 누르면 잎이 내려앉아 QR 코드가 돼요.' : '휴대폰 카메라로 비춰 주세요. 다시 누르면 나무로 돌아가요.'}</p>
      </>}
  </>;
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
