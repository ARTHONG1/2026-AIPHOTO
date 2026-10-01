'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, Download, Play, Pause, Share2, Sparkles, Video, Volume2, VolumeX, Eye } from 'lucide-react';
import type { LivePhotoMeta } from '@/lib/storage';

type Props = {
  meta: LivePhotoMeta;
};

export default function LivePhotoView({ meta }: Props) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [arMode, setArMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoFeedRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const playChime = useCallback(() => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.6);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {
      // Audio autoplay policy
    }
  }, [isMuted]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = meta.photoUrl;
    img.onload = () => {
      imgRef.current = img;
    };
  }, [meta.photoUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2.2 + 0.8,
      speedY: Math.random() * 0.7 + 0.3,
      speedX: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.7 + 0.2,
      phase: Math.random() * Math.PI * 2,
    }));

    let startTime = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const img = imgRef.current;
      if (img && img.complete) {
        ctx.save();

        if (isPlaying) {
          const zoom = 1.0 + 0.04 * (0.5 + 0.5 * Math.sin(elapsed * 1.4));
          const swayX = Math.sin(elapsed * 1.1) * 6;
          const swayY = Math.cos(elapsed * 0.9) * 4;

          const cx = canvas.width / 2;
          const cy = canvas.height / 2;

          ctx.translate(cx + swayX, cy + swayY);
          ctx.scale(zoom, zoom);
          ctx.translate(-cx, -cy);
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        if (isPlaying) {
          ctx.save();
          for (const p of particles) {
            p.y -= p.speedY;
            p.x += p.speedX;
            if (p.y < 0) p.y = canvas.height;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;

            const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2 + p.phase);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(180, 240, 255, " + (p.alpha * pulse) + ")";
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(100, 220, 255, 0.8)';
            ctx.fill();
          }
          ctx.restore();

          const sweepCycle = (elapsed % 4.5) / 4.5;
          if (sweepCycle < 0.45) {
            const sweepPos = (sweepCycle / 0.45) * (canvas.width + canvas.height) - canvas.height / 2;
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            const grad = ctx.createLinearGradient(sweepPos - 80, sweepPos - 80, sweepPos + 80, sweepPos + 80);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(0.5, 'rgba(120,220,255,0.25)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (arMode) {
      navigator.mediaDevices
        ?.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        .then((s) => {
          streamRef.current = s;
          if (videoFeedRef.current) {
            videoFeedRef.current.srcObject = s;
            videoFeedRef.current.play();
          }
        })
        .catch((err) => {
          console.warn('AR camera unavailable:', err);
          alert('카메라 접근 권한이 필요합니다.');
          setArMode(false);
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [arMode]);

  const downloadPhoto = async () => {
    try {
      const res = await fetch(meta.photoUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "ai-hancut-" + meta.id + ".jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(meta.photoUrl, '_blank');
    }
  };

  const downloadLiveVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isRecording) return;
    setIsRecording(true);

    try {
      const stream = canvas.captureStream(30);
      const mime = MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        a.download = "ai-hancut-live-" + meta.id + "." + ext;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setIsRecording(false);
      };

      recorder.start();
      playChime();
      setTimeout(() => recorder.stop(), 3200);
    } catch (err) {
      console.error('Video recording failed', err);
      setIsRecording(false);
      alert('동영상 저장을 지원하지 않는 브라우저입니다.');
    }
  };

  const copyLink = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (navigator.share) {
      await navigator.share({
        title: '인천과학대제전 AI한컷 라이브 포토',
        url: window.location.href,
      });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#070b16] px-4 py-6 text-slate-100">
      <header className="flex w-full max-w-md items-center justify-between border-b border-cyan-900/40 pb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8] animate-pulse" />
          <h1 className="text-lg font-bold tracking-tight text-cyan-300">제28회 인천과학대제전</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/50 px-3 py-1 text-xs text-cyan-200 backdrop-blur">
          <Sparkles className="size-3 text-cyan-400" />
          <span>AR LIVE PHOTO</span>
        </div>
      </header>

      <section className="relative my-5 flex w-full max-w-md flex-col items-center">
        <div className="relative aspect-[2/3] w-full max-w-[360px] overflow-hidden rounded-2xl border-2 border-cyan-500/40 bg-slate-900 shadow-[0_10px_40px_rgba(6,182,212,0.15)]">
          {arMode ? (
            <>
              <video
                ref={videoFeedRef}
                playsInline
                autoPlay
                muted
                className="absolute inset-0 size-full object-cover"
              />
              <canvas
                ref={canvasRef}
                width={720}
                height={1080}
                className="absolute inset-0 size-full object-contain opacity-80 mix-blend-screen transition-opacity"
              />
              <div className="pointer-events-none absolute inset-4 rounded-xl border border-dashed border-cyan-400/70 shadow-[inset_0_0_20px_rgba(6,182,212,0.3)]">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cyan-500 px-3 py-0.5 text-[11px] font-semibold text-slate-950">
                  종이 사진을 이 틀에 맞춰보세요
                </div>
              </div>
            </>
          ) : (
            <>
              <canvas
                ref={canvasRef}
                width={720}
                height={1080}
                className="size-full object-contain cursor-pointer transition-transform duration-300"
                onClick={() => {
                  setIsPlaying((p) => !p);
                  if (!isPlaying) playChime();
                }}
              />
              <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-md">
                <span className={"size-2 rounded-full " + (isPlaying ? "bg-emerald-400 animate-ping" : "bg-slate-400")} />
                <span className="font-medium">{isPlaying ? 'LIVE ON' : 'PAUSED'}</span>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white backdrop-blur-md transition-opacity hover:opacity-80"
            aria-label={isMuted ? '소리 켜기' : '소리 끄기'}
          >
            {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>

        <div className="mt-3 flex w-full max-w-[360px] items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => {
              setIsPlaying((p) => !p);
              if (!isPlaying) playChime();
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-950/40 py-2.5 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-900/50"
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
            <span>{isPlaying ? '일시 정지' : '라이브 재생'}</span>
          </button>

          <button
            type="button"
            onClick={() => setArMode((m) => !m)}
            className={"flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all " +
              (arMode
                ? "border border-amber-400 bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                : "border border-cyan-500/30 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-900/50")}
          >
            <Camera className="size-4" />
            <span>{arMode ? '일반 뷰어' : 'AR 카메라'}</span>
          </button>
        </div>
      </section>

      <section className="flex w-full max-w-md flex-col gap-2.5 pt-2">
        <button
          type="button"
          onClick={downloadPhoto}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-cyan-500 py-3.5 text-base font-bold text-slate-950 shadow-[0_4px_20px_rgba(6,182,212,0.3)] transition-transform active:scale-[0.98] hover:bg-cyan-400"
        >
          <Download className="size-5" />
          <span>고화질 인쇄 사진 저장 (4×6)</span>
        </button>

        <button
          type="button"
          onClick={downloadLiveVideo}
          disabled={isRecording}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-cyan-500/40 bg-slate-900/90 py-3.5 text-base font-bold text-cyan-300 transition-all active:scale-[0.98] hover:bg-slate-800 disabled:opacity-50"
        >
          <Video className="size-5 text-cyan-400" />
          <span>{isRecording ? '영상 생성 중...' : '움직이는 라이브 영상 저장 (WebM/MP4)'}</span>
        </button>

        <button
          type="button"
          onClick={copyLink}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/50 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          {copied ? <Check className="size-4 text-emerald-400" /> : <Share2 className="size-4" />}
          <span>{copied ? '링크가 복사되었습니다!' : '친구들에게 링크 공유하기'}</span>
        </button>
      </section>

      <footer className="mt-8 flex w-full max-w-md flex-col gap-2 rounded-2xl border border-cyan-900/30 bg-slate-900/40 p-4 text-xs text-slate-400">
        <div className="flex items-center gap-2 font-semibold text-cyan-300">
          <Eye className="size-4 text-cyan-400" />
          <span>AR 라이브 포토 즐기는 팁</span>
        </div>
        <p className="leading-relaxed">
          • 인쇄된 종이 사진을 두고 <strong>[AR 카메라]</strong> 버튼을 누른 후, 카메라로 사진을 비추면 마법처럼 사진이 살아 움직입니다.
        </p>
        <p className="leading-relaxed">
          • [움직이는 라이브 영상 저장]을 누르면 인스타그램 스토리나 카카오톡에 바로 올릴 수 있는 짧은 영상 클립이 갤러리에 저장됩니다.
        </p>
      </footer>
    </main>
  );
}

