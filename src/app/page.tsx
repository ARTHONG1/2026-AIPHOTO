'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Download, Sparkles, Wand2 } from 'lucide-react';
import { CopyrightDialog } from '@/components/copyright-dialog';
import { LobbyCanvas, type LobbyCanvasHandle } from '@/components/lobby/lobby-canvas';
import { clearSession } from '@/lib/session';
import { cn } from '@/lib/utils';

const BOOTH_URL = '/booth?autoStart=true';
const WARP_MS = 1100;

const LINKS = [
  { href: 'https://www.yes24.com/product/goods/177808924', label: '제미나이 더 알아보기' },
  { href: 'https://product.kyobobook.co.kr/detail/S000217378952', label: '바이브코딩 더 알아보기' },
  { href: 'https://studio--studio-6411906927-c7113.us-central1.hosted.app', label: '개발자 정보' },
  { href: 'https://studio--studio-2646915464-a86ca.us-central1.hosted.app/', label: '클래스똑딱' },
];

const STEPS = [
  { icon: Camera, label: '찰칵' },
  { icon: Wand2, label: '변신' },
  { icon: Download, label: '저장' },
];

const TITLE = ['A', 'I', '한', '컷'];
// Sparkles scattered around the title: [left %, top %, size rem, delay s].
const SPARKS: [number, number, number, number][] = [
  [4, 18, 2.2, 0],
  [14, 78, 1.4, 0.9],
  [30, 4, 1.6, 1.7],
  [48, 92, 1.2, 0.4],
  [66, 2, 2, 1.2],
  [84, 80, 1.6, 2.1],
  [96, 22, 2.4, 0.6],
  [102, 60, 1.2, 1.5],
  [-4, 52, 1.4, 2.4],
];

export default function HomePage() {
  const router = useRouter();
  const sceneRef = useRef<LobbyCanvasHandle>(null);
  const [isCopyrightOpen, setIsCopyrightOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    clearSession();
    router.prefetch('/booth');
  }, [router]);

  const start = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Let modified clicks (new tab etc.) behave like a normal link.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      if (leaving) return;
      setLeaving(true);
      await sceneRef.current?.warp(WARP_MS);
      router.push(BOOTH_URL);
    },
    [leaving, router]
  );

  return (
    <main className="relative isolate flex h-dvh flex-col overflow-hidden bg-[#03040b]">
      <LobbyCanvas ref={sceneRef} className="absolute inset-0 -z-10" />
      <div aria-hidden className="lobby-vignette pointer-events-none absolute inset-0 -z-10" />
      {/* Big-bang flash when the lobby first appears. */}
      <div aria-hidden className="lobby-bang pointer-events-none absolute inset-0 z-20" />
      {/* White flash at the end of the hyperspace jump. */}
      <div
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 z-30 bg-white transition-opacity duration-300', leaving ? 'opacity-100' : 'opacity-0')}
        style={{ transitionDelay: leaving ? WARP_MS - 250 + 'ms' : '0ms' }}
      />

      <header className={cn('flex items-center justify-between gap-4 p-5 transition-opacity duration-300 md:px-8', leaving && 'opacity-0')}>
        <span className="lobby-badge">
          <span className="size-2 animate-pulse rounded-full bg-accent shadow-[0_0_12px_hsl(var(--accent))]" aria-hidden />
          과학대제전 AI 체험 부스
        </span>
      </header>

      <section className={cn('flex min-h-0 flex-1 flex-col items-center justify-end gap-4 px-6 pb-6 text-center transition-[opacity,transform] duration-500 md:gap-6', leaving && 'scale-125 opacity-0')}>
        <h1 className="lobby-hero font-display">
          <span aria-hidden className="lobby-rays" />
          <span aria-hidden className="lobby-halo" />
          <span className="sr-only">AI한컷, AI와 함께 만드는 나만의 과학 사진</span>
          <span aria-hidden className="lobby-title-float relative block">
            <span className="lobby-title">
              {TITLE.map((ch, i) => (
                <span key={ch} className="lobby-letter" data-ch={ch} style={{ '--i': i } as React.CSSProperties}>
                  {ch}
                </span>
              ))}
            </span>
            {SPARKS.map(([left, top, size, delay]) => (
              <Sparkles
                key={left + '-' + top}
                className="lobby-spark"
                style={{ left: left + '%', top: top + '%', width: size + 'rem', height: size + 'rem', animationDelay: delay + 's' }}
              />
            ))}
          </span>
          <span aria-hidden className="lobby-tagline">AI와 함께 만드는 나만의 과학 사진</span>
        </h1>

        <ol aria-label="체험 순서" className="flex animate-rise items-center gap-2 [animation-delay:0.95s] md:gap-4">
          {STEPS.map((step, i) => (
            <li key={step.label} className="flex items-center gap-2 md:gap-4">
              {i > 0 && <span aria-hidden className="lobby-beam w-8 md:w-16" />}
              <span className="flex flex-col items-center gap-1.5">
                <span className="lobby-orb">
                  <step.icon className="size-7 md:size-9" aria-hidden />
                </span>
                <span className="font-display text-lg text-foreground/80 md:text-xl">{step.label}</span>
              </span>
            </li>
          ))}
        </ol>

        <span className="lobby-start-wrap animate-rise [animation-delay:1.1s]">
          <Link href={BOOTH_URL} onClick={start} className="lobby-start" aria-disabled={leaving}>
            <Sparkles className="size-9" aria-hidden />
            시작하기
          </Link>
        </span>
      </section>

      <footer className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pb-4 text-xs text-white/45 transition-opacity duration-300 md:px-8', leaving && 'opacity-0')}>
        <span className="flex items-center gap-3">
          <img src="/brand/ice-logo.webp" alt="인천광역시교육청" className="h-6 w-auto rounded bg-white/85 px-1.5 py-0.5" />
          개발자 인천봉수초 교사 홍찬우
        </span>
        <nav aria-label="관련 링크" className="flex flex-wrap gap-x-4 gap-y-1">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              {link.label}
            </a>
          ))}
          <button type="button" onClick={() => setIsCopyrightOpen(true)} className="hover:text-white">
            저작권 안내
          </button>
        </nav>
      </footer>

      <CopyrightDialog isOpen={isCopyrightOpen} onOpenChange={setIsCopyrightOpen} />
    </main>
  );
}
