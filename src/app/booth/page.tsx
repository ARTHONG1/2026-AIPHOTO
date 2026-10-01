'use client';

import { ChangeEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, Check, Home, RefreshCw, Upload } from 'lucide-react';
import { cropToPhoto, fileToPhoto } from '@/lib/image';
import { setPhoto } from '@/lib/session';

const COUNTDOWN_SECONDS = 10;
const AUTO_CONFIRM_SECONDS = 3;

type CameraState = 'pending' | 'ready' | 'denied';

function BoothClient() {
  const router = useRouter();
  const autoStart = useSearchParams().get('autoStart') === 'true';
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<CameraState>('pending');
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(0);
  const [photo, setPhotoData] = useState<string | null>(null);
  const [autoLeft, setAutoLeft] = useState<number | null>(null);

  useEffect(() => {
    router.prefetch('/studio');
    let cancelled = false;
    let stream: MediaStream | null = null;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera('denied');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) return;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamera('ready');
      } catch (error) {
        console.error('camera error', error);
        if (!cancelled) setCamera('denied');
      }
    })();
    return () => {
      cancelled = true;
      // Release the camera so the next visitor (or another tab) can use it.
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [router]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setPhotoData(cropToPhoto(video, video.videoWidth, video.videoHeight, true));
    setFlash((n) => n + 1);
    setCount(null);
  }, []);

  // Start the countdown automatically when arriving from the home screen.
  useEffect(() => {
    if (autoStart && camera === 'ready' && !photo) setCount(COUNTDOWN_SECONDS);
  }, [autoStart, camera, photo]);

  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      capture();
      return;
    }
    const timer = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, capture]);

  const confirm = useCallback(() => {
    if (!photo) return;
    setPhoto(photo);
    router.push('/studio');
  }, [photo, router]);

  useEffect(() => {
    setAutoLeft(photo && autoStart ? AUTO_CONFIRM_SECONDS : null);
  }, [photo, autoStart]);

  useEffect(() => {
    if (autoLeft === null) return;
    if (autoLeft === 0) {
      confirm();
      return;
    }
    const timer = setTimeout(() => setAutoLeft(autoLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [autoLeft, confirm]);

  const retake = () => {
    setPhotoData(null);
    setAutoLeft(null);
    if (!autoStart) setCount(null);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await fileToPhoto(file));
      router.push('/studio');
    } catch {
      alert('이미지를 열 수 없어요. 다른 사진을 골라 주세요.');
    }
  };

  const counting = count !== null && count > 0;

  return (
    <main className="flex min-h-dvh flex-col items-center gap-5 p-4 md:p-6">
      <header className="flex w-full max-w-5xl items-center justify-between">
        <Link href="/" className="btn-ghost px-4 py-2 text-base">
          <Home className="size-5" aria-hidden /> 처음으로
        </Link>
        <h1 className="font-display text-3xl text-primary">사진 찍기</h1>
        <span className="w-28" aria-hidden />
      </header>

      <p className="text-lg text-muted-foreground" aria-live="polite">
        {photo
          ? '멋지게 나왔나요?'
          : counting
            ? '카메라를 보고 멋진 표정을 지어 보세요!'
            : camera === 'denied'
              ? '카메라를 쓸 수 없어요. 사진을 올려서 시작할 수 있어요.'
              : '얼굴과 상체가 화면 안에 들어오게 서 주세요.'}
      </p>

      <div className="relative aspect-[2/3] w-full max-w-[min(26rem,calc((100dvh-15rem)*2/3))] overflow-hidden rounded-[2rem] border-4 border-white/15 bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 size-full -scale-x-100 object-cover"
          autoPlay
          muted
          playsInline
          aria-label="카메라 미리보기"
        />
        {photo && <img src={photo} alt="찍은 사진" className="absolute inset-0 size-full object-cover" />}

        {camera === 'pending' && !photo && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">카메라 준비 중…</div>
        )}
        {camera === 'denied' && !photo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Camera className="size-12 text-muted-foreground" aria-hidden />
            <p>브라우저 주소창의 카메라 권한을 허용하거나 아래 사진 올리기를 눌러 주세요.</p>
          </div>
        )}

        {counting && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
            <span key={count} className="font-display text-[9rem] leading-none text-white drop-shadow-lg animate-pop" aria-live="assertive">
              {count}
            </span>
          </div>
        )}
        {flash > 0 && <div key={flash} className="pointer-events-none absolute inset-0 bg-white animate-flash" aria-hidden />}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {photo ? (
          <>
            <button type="button" className="btn-ghost" onClick={retake}>
              <RefreshCw className="size-5" aria-hidden /> 다시 찍기
            </button>
            <button type="button" className="btn-primary px-10" onClick={confirm}>
              <Check className="size-6" aria-hidden /> 이 사진으로 하기{autoLeft !== null && autoLeft > 0 ? ' (' + autoLeft + ')' : ''}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn-primary px-10"
              onClick={() => (counting ? capture() : setCount(COUNTDOWN_SECONDS))}
              disabled={camera !== 'ready'}
            >
              <Camera className="size-6" aria-hidden /> {counting ? '지금 찍기' : '촬영 시작'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={counting}>
              <Upload className="size-5" aria-hidden /> 사진 올리기
            </button>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </main>
  );
}

export default function BoothPage() {
  return (
    <Suspense fallback={null}>
      <BoothClient />
    </Suspense>
  );
}
