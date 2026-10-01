'use client';

import { ChangeEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, Check, Home, RefreshCw, ScanFace, Upload } from 'lucide-react';
import { cropToPhoto, fileToPhoto } from '@/lib/image';
import { setPhoto } from '@/lib/session';
import { cn } from '@/lib/utils';

const COUNTDOWN_SECONDS = 5;
const AUTO_CONFIRM_SECONDS = 4;

type CameraState = 'pending' | 'ready' | 'denied';

const TIPS = ['얼굴이 잘 보이게 정면을 봐 주세요', '머리부터 무릎까지 들어오면 가장 좋아요', '모자나 마스크는 잠깐 벗어 주세요'];

// Head-to-knee silhouette in a 200x300 box: head, neck, shoulders, arms at the sides.
const GUIDE_PATH =
  'M100 30 C84 30 76 43 76 58 C76 74 85 86 92 90 L92 98 C74 101 56 106 48 118 C42 128 40 150 39 176 L38 230 C38 238 50 238 51 230 L55 170 L60 176 L60 300 L140 300 L140 176 L145 170 L149 230 C150 238 162 238 162 230 L161 176 C160 150 158 128 152 118 C144 106 126 101 108 98 L108 90 C115 86 124 74 124 58 C124 43 116 30 100 30 Z';

/** Head-and-body outline that shows visitors where to stand. */
function FramingGuide({ dim }: { dim: boolean }) {
  return (
    <svg viewBox="0 0 200 300" aria-hidden className={cn('pointer-events-none absolute inset-0 size-full transition-opacity duration-500', dim ? 'opacity-0' : 'opacity-100')}>
      <defs>
        <mask id="guide-cut">
          <rect width="200" height="300" fill="white" />
          <path d={GUIDE_PATH} fill="black" />
        </mask>
      </defs>
      <rect width="200" height="300" fill="rgb(3 4 16 / 0.45)" mask="url(#guide-cut)" />
      <path d={GUIDE_PATH} fill="none" stroke="white" strokeOpacity="0.9" strokeWidth="1.4" strokeDasharray="5 4" strokeLinejoin="round" />
    </svg>
  );
}

function CountdownRing({ count, total }: { count: number; total: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
      <div className="relative flex size-52 items-center justify-center">
        <svg viewBox="0 0 160 160" className="absolute inset-0 size-full -rotate-90" aria-hidden>
          <circle cx="80" cy="80" r={r} fill="rgb(0 0 0 / 0.35)" stroke="rgb(255 255 255 / 0.2)" strokeWidth="8" />
          <circle
            cx="80"
            cy="80"
            r={r}
            fill="none"
            stroke="hsl(48 100% 62%)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - count / total)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <span key={count} className="font-display text-[7.5rem] leading-none text-white drop-shadow-lg animate-pop" aria-live="assertive">
          {count}
        </span>
      </div>
    </div>
  );
}

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
  const [tip, setTip] = useState(0);

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
          video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
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

  useEffect(() => {
    const timer = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 3500);
    return () => clearInterval(timer);
  }, []);

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
    setCount(camera === 'ready' ? COUNTDOWN_SECONDS : null);
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
  const status = photo
    ? '잘 나왔나요?'
    : counting
      ? '카메라를 보고 멋진 표정!'
      : camera === 'denied'
        ? '카메라를 쓸 수 없어요'
        : camera === 'pending'
          ? '카메라를 켜고 있어요'
          : '점선 안에 서 주세요';

  return (
    <main className="flex h-dvh flex-col items-center gap-3 p-3 md:gap-4 md:p-5">
      <header className="flex w-full items-center justify-between gap-3">
        <Link href="/" className="btn-ghost min-h-11 px-4 py-2 text-base">
          <Home className="size-5" aria-hidden /> <span className="hidden sm:inline">처음으로</span>
        </Link>
        <ol aria-label="진행 순서" className="flex items-center gap-2 font-display text-lg">
          <li className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground">1 사진 찍기</li>
          <li className="px-2 text-foreground/40">2 꾸미기</li>
          <li className="px-2 text-foreground/40">3 완성</li>
        </ol>
        <span className="w-24" aria-hidden />
      </header>

      <div className="text-center">
        <h1 className="font-display text-4xl text-foreground md:text-5xl" aria-live="polite">
          {status}
        </h1>
        {!photo && camera !== 'denied' && (
          <p key={tip} className="mt-1 flex items-center justify-center gap-2 text-lg text-muted-foreground animate-rise">
            <ScanFace className="size-5 text-accent" aria-hidden /> {TIPS[tip]}
          </p>
        )}
      </div>

      <div className="relative aspect-[2/3] min-h-0 w-full max-w-[min(30rem,calc((100dvh-15.5rem)*2/3))] flex-1">
        <div aria-hidden className={cn('absolute -inset-2 rounded-[2.4rem] bg-gradient-to-br from-primary via-[#ff7ad9] to-accent opacity-60 blur-lg', counting && 'animate-pulse opacity-90')} />
        <div className="relative size-full overflow-hidden rounded-[2rem] border-4 border-white/80 bg-black shadow-2xl">
          <video
            ref={videoRef}
            className="absolute inset-0 size-full -scale-x-100 object-cover"
            autoPlay
            muted
            playsInline
            aria-label="카메라 미리보기"
          />
          {camera === 'ready' && !photo && <FramingGuide dim={counting} />}
          {photo && <img src={photo} alt="찍은 사진" className="absolute inset-0 size-full object-cover animate-[result-in_0.5s_ease-out_both]" />}

          {camera === 'pending' && !photo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Camera className="size-12 animate-pulse" aria-hidden />
              카메라 준비 중…
            </div>
          )}
          {camera === 'denied' && !photo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <Camera className="size-14 text-muted-foreground" aria-hidden />
              <p className="text-lg">주소창 왼쪽의 카메라 권한을 허용한 뒤 새로고침하거나, 아래 사진 올리기를 눌러 주세요.</p>
            </div>
          )}

          {counting && <CountdownRing count={count} total={COUNTDOWN_SECONDS} />}
          {flash > 0 && <div key={flash} className="pointer-events-none absolute inset-0 bg-white animate-flash" aria-hidden />}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pb-1">
        {photo ? (
          <>
            <button type="button" className="btn-ghost min-h-14 px-6" onClick={retake}>
              <RefreshCw className="size-5" aria-hidden /> 다시 찍기
            </button>
            <button type="button" className="btn-primary min-h-16 px-12 text-2xl" onClick={confirm}>
              <Check className="size-7" aria-hidden /> 이 사진으로 꾸미기
              {autoLeft !== null && autoLeft > 0 && <span className="rounded-full bg-black/10 px-2.5 text-lg">{autoLeft}</span>}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn-primary min-h-16 px-12 text-2xl"
              onClick={() => (counting ? capture() : setCount(COUNTDOWN_SECONDS))}
              disabled={camera !== 'ready'}
            >
              <Camera className="size-7" aria-hidden /> {counting ? '지금 바로 찍기' : '촬영 시작'}
            </button>
            <button type="button" className="btn-ghost min-h-14 px-6" onClick={() => fileRef.current?.click()} disabled={counting}>
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
