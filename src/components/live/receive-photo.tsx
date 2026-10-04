'use client';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Loader2, RotateCcw, Upload } from 'lucide-react';
import LivePhotoView from './live-photo-view';
import type { LivePhotoMeta } from '@/lib/live-photo';
import { receivePhoto, type TransferState } from '@/lib/transfer/client';
import { MAX_IMAGE_BYTES } from '@/lib/transfer/protocol';

export function ReceivePhoto({ id }: { id?: string }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<TransferState>({ status: 'waiting' });
  const [meta, setMeta] = useState<LivePhotoMeta | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [fileError, setFileError] = useState('');
  const photoUrl = useRef<string | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const token = useRef('');
  const accept = (blob: Blob, info: Omit<LivePhotoMeta, 'photoUrl'>) => {
    if (!mounted.current) return;
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = URL.createObjectURL(blob);
    setMeta({ ...info, photoUrl: photoUrl.current });
    if (id) history.replaceState(null, '', '/receive/' + id);
  };
  useEffect(() => {
    mounted.current = true;
    setReady(true);
    return () => { mounted.current = false; stop.current?.(); if (photoUrl.current) URL.revokeObjectURL(photoUrl.current); };
  }, []);
  useEffect(() => {
    if (!id) return;
    if (!token.current) token.current = location.hash.slice(1);
    stop.current = receivePhoto(id, token.current, setState, accept);
    return () => { stop.current?.(); stop.current = null; };
    // id/attempt defines the receive session; accepting a blob must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setFileError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_IMAGE_BYTES) { setFileError('20MB 이하의 JPG, PNG, WebP 사진을 선택해 주세요.'); return; }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      if (!mounted.current) return;
      stop.current?.();
      accept(file, { id: crypto.randomUUID(), frameId: 'festival', createdAt: new Date().toISOString() });
    } catch { setFileError('사진을 읽지 못했어요. 다른 사진을 선택해 주세요.'); }
    finally { URL.revokeObjectURL(url); }
  };
  if (meta) return <>
    <p className="bg-cyan-950 px-4 pt-4 text-center text-xs text-cyan-100">사진은 이 휴대폰에서만 열려 있어요. 새로고침하기 전에 사진을 저장해 주세요.</p>
    <LivePhotoView key={meta.id} meta={meta} />
  </>;
  const busy = state.status === 'connecting' || state.status === 'sending';
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#070b16] px-6 py-8 text-center text-slate-100">
    <h1 className="font-display text-4xl text-cyan-300">AI한컷 라이브 포토</h1>
    {id && <div className="flex max-w-sm flex-col items-center gap-3" role="status" aria-live="polite">
      {busy && <Loader2 className="size-10 animate-spin text-cyan-300" />}
      <p>{state.status === 'sending' ? `사진을 받는 중이에요 (${state.progress ?? 0}%)` : state.status === 'error' ? state.message : '부스 PC와 연결하는 중이에요.'}</p>
      {state.status === 'error' && <button className="btn-primary" onClick={() => { setState({ status: 'waiting' }); setAttempt((n) => n + 1); }}><RotateCcw className="size-5" /> 다시 연결하기</button>}
      <p className="text-sm text-slate-400">사진을 받을 때까지 부스의 결과 화면을 유지해 주세요.</p>
    </div>}
    <div className="panel flex max-w-sm flex-col gap-3 p-5">
      <p className="text-sm">이미 받은 사진이 있나요?<br />휴대폰에 저장한 사진으로 스티커·라이브 효과·AR을 사용할 수 있어요.</p>
      <label className={ready ? 'btn-accent cursor-pointer' : 'btn-accent cursor-wait opacity-60'}><Upload className="size-5" /> 저장한 사진 선택<input type="file" accept="image/jpeg,image/png,image/webp" onChange={openFile} disabled={!ready} className="sr-only" aria-label="저장한 사진 선택" /></label>
      {fileError && <p role="alert" className="text-sm text-red-300">{fileError}</p>}
      <p className="text-xs text-slate-400">선택한 사진은 서버에 업로드하지 않습니다.</p>
    </div>
    <Link href="/" className="text-sm text-slate-400 underline">첫 화면으로</Link>
  </main>;
}
