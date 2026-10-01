'use client';

import { useEffect, useState } from 'react';

const FACTS = [
  '빛은 1초에 지구를 일곱 바퀴 반이나 돌 수 있어요.',
  '문어는 심장이 세 개예요.',
  '번개는 태양 표면보다 약 다섯 배 더 뜨거워요.',
  '우리 몸의 DNA를 모두 이으면 태양계를 여러 번 왕복할 수 있어요.',
  '금성에서는 하루가 1년보다 더 길어요.',
  '꿀은 수천 년이 지나도 상하지 않아요.',
  '달은 해마다 지구에서 약 3.8cm씩 멀어지고 있어요.',
  '인공지능은 수많은 사진을 보고 규칙을 스스로 배워요.',
];

export function GeneratingOverlay({ photo }: { photo: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const fact = FACTS[Math.floor(seconds / 6) % FACTS.length];

  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/95 p-6 text-center">
      <div className="relative aspect-[2/3] w-56 overflow-hidden rounded-3xl border-4 border-primary/60 sm:w-64">
        <img src={photo} alt="" className="size-full object-cover opacity-70" />
        <div className="absolute inset-x-0 top-0 h-full animate-scan bg-gradient-to-b from-transparent via-accent/50 to-transparent" aria-hidden />
      </div>
      <div className="space-y-2">
        <p className="font-display text-4xl text-primary">AI가 사진을 만들고 있어요</p>
        <p className="text-muted-foreground">
          배경과 동작을 합성하고 있어요 · 30초~1분쯤 걸려요 · {seconds}초
        </p>
      </div>
      <p key={fact} className="panel max-w-md px-6 py-4 text-lg animate-rise">
        <span className="mr-2 font-display text-accent">과학 상식</span>
        {fact}
      </p>
    </div>
  );
}
