'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const FACTS = [
  '빛은 1초에 지구를 일곱 바퀴 반이나 돌 수 있어요.',
  '문어는 심장이 세 개예요.',
  '번개는 태양 표면보다 약 다섯 배 더 뜨거워요.',
  '금성에서는 하루가 1년보다 더 길어요.',
  '꿀은 수천 년이 지나도 상하지 않아요.',
  '달은 해마다 지구에서 약 3.8cm씩 멀어지고 있어요.',
  '인공지능은 수많은 사진을 보고 규칙을 스스로 배워요.',
  '우리 몸의 뼈는 태어날 때 약 300개, 어른이 되면 206개예요.',
];

// Stages follow the measured timeline of one Pro 1K generation (about 30 s).
const STAGES = [
  { at: 0, label: '얼굴을 기억하고 있어요' },
  { at: 4, label: '배경 속으로 이동하고 있어요' },
  { at: 11, label: '포즈와 소품을 맞추고 있어요' },
  { at: 20, label: '빛과 그림자를 다듬고 있어요' },
  { at: 30, label: '거의 다 됐어요' },
];
const EXPECTED_SECONDS = 30;

export function GeneratingOverlay({ photo, background }: { photo: string; background?: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = performance.now();
    const timer = setInterval(() => setSeconds((performance.now() - started) / 1000), 250);
    return () => clearInterval(timer);
  }, []);

  const stageIndex = STAGES.reduce((acc, s, i) => (seconds >= s.at ? i : acc), 0);
  // Eases toward 95% so the bar never looks finished before the image arrives.
  const progress = Math.min(0.95, 1 - Math.exp((-seconds / EXPECTED_SECONDS) * 2.3));
  const fact = FACTS[Math.floor(seconds / 7) % FACTS.length];

  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#070a1f]/95 p-6">
      <div aria-hidden className="absolute inset-0 opacity-40 [background:radial-gradient(60%_50%_at_50%_40%,hsl(250_80%_45%/0.6),transparent_70%)]" />
      <div className="relative flex w-full max-w-4xl flex-col items-center gap-8 md:flex-row md:gap-12">
        <div className="relative aspect-[2/3] w-52 shrink-0 sm:w-64">
          <div aria-hidden className="absolute -inset-3 rounded-[2.2rem] bg-gradient-to-br from-primary via-[#ff7ad9] to-accent opacity-70 blur-xl animate-pulse" />
          <div className="relative size-full overflow-hidden rounded-[2rem] border-4 border-white/80 bg-black shadow-2xl">
            {background && <img src={background} alt="" className="absolute inset-0 size-full object-cover opacity-0 animate-[fade-in_4s_ease-in_3s_forwards]" />}
            <img src={photo} alt="" className="absolute inset-0 size-full object-cover opacity-80 mix-blend-screen" />
            <div className="absolute inset-x-0 top-0 h-full animate-scan bg-gradient-to-b from-transparent via-accent/60 to-transparent" aria-hidden />
          </div>
        </div>

        <div className="flex w-full flex-col gap-6 text-center md:text-left">
          <div className="space-y-2">
            <p className="font-display text-4xl text-primary md:text-5xl">AI가 사진을 만들고 있어요</p>
            <p key={stageIndex} className="font-display text-2xl text-foreground animate-rise">
              {STAGES[stageIndex].label}
            </p>
          </div>

          <div className="space-y-2">
            <div className="h-3 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div
                className="h-full origin-left rounded-full bg-gradient-to-r from-primary via-[#ff9be0] to-accent transition-transform duration-300 ease-out"
                style={{ transform: 'scaleX(' + progress + ')' }}
              />
            </div>
            <ol className="flex justify-between gap-1 text-sm" aria-label="진행 단계">
              {STAGES.slice(0, 4).map((s, i) => (
                <li key={s.at} className={cn('flex items-center gap-1.5', i <= stageIndex ? 'text-foreground' : 'text-foreground/35')}>
                  <span className={cn('size-2 rounded-full', i < stageIndex ? 'bg-accent' : i === stageIndex ? 'bg-primary animate-pulse' : 'bg-white/25')} />
                  {['얼굴', '배경', '포즈', '마무리'][i]}
                </li>
              ))}
            </ol>
            <p className="text-sm text-muted-foreground">
              보통 {EXPECTED_SECONDS}초 안팎 걸려요 · {Math.floor(seconds)}초
            </p>
          </div>

          <p key={fact} className="panel px-6 py-4 text-left text-lg animate-rise">
            <span className="mb-1 block font-display text-accent">알고 있나요?</span>
            {fact}
          </p>
        </div>
      </div>
    </div>
  );
}
