'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Camera, Check, Home, ImageIcon, PersonStanding, Shirt, Sparkles, X } from 'lucide-react';
import { generatePhotoAction } from '@/app/actions';
import { GeneratingOverlay } from '@/components/studio/generating-overlay';
import { PresetGrid } from '@/components/studio/preset-grid';
import { ResultView } from '@/components/studio/result-view';
import {
  BACKGROUND_CATEGORIES,
  BACKGROUNDS,
  MAX_PROPS,
  POSE_CATEGORIES,
  POSES,
  PROP_CATEGORIES,
  PROPS,
  findBackground,
  findPose,
  findProp,
  type Preset,
} from '@/lib/presets';
import { EMPTY_SELECTION, clearSession, getPhoto, getResult, loadSelection, saveSelection, setResult, type Selection } from '@/lib/session';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'background', label: '배경', icon: ImageIcon, title: '어디로 떠나 볼까요?', hint: '사진 속 장소를 골라요' },
  { id: 'pose', label: '동작', icon: PersonStanding, title: '어떤 포즈를 할까요?', hint: '막대 인형처럼 팔다리가 바뀌어요' },
  { id: 'prop', label: '소품', icon: Shirt, title: '무엇을 입고 들어 볼까요?', hint: '최대 ' + MAX_PROPS + '개까지 골라요' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

// Auto-advance after picking a background or pose, short enough to feel instant.
const ADVANCE_MS = 260;

function TraySlot({ item, variant, placeholder, onClear }: { item?: Preset; variant: 'background' | 'pose' | 'prop'; placeholder: string; onClear?: () => void }) {
  return (
    <div className="tray-slot" data-filled={Boolean(item)}>
      {item ? (
        <>
          <img
            src={item.thumb}
            alt=""
            className={cn('size-full', variant === 'background' ? 'object-cover' : 'object-contain p-1.5', variant === 'pose' && 'pose-stage', variant === 'prop' && 'bg-white')}
          />
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label={item.name + ' 빼기'}
              className="absolute -right-0.5 -top-0.5 flex size-6 items-center justify-center rounded-bl-xl rounded-tr-xl bg-black/70 text-white hover:bg-destructive"
            >
              <X className="size-3.5" strokeWidth={3} aria-hidden />
            </button>
          )}
        </>
      ) : (
        <span className="px-1 text-center text-xs text-white/40">{placeholder}</span>
      )}
    </div>
  );
}

export default function StudioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [photo, setPhotoState] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [step, setStep] = useState<StepId>('background');
  const [generating, setGenerating] = useState(false);
  const [result, setResultState] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const saved = getPhoto();
    if (!saved) {
      router.replace('/booth');
      return;
    }
    setPhotoState(saved);
    setSelection(loadSelection());
    setResultState(getResult());
    return () => clearTimeout(advanceTimer.current);
  }, [router]);

  const update = useCallback((next: Selection) => {
    setSelection(next);
    saveSelection(next);
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const goTo = useCallback((id: StepId) => {
    clearTimeout(advanceTimer.current);
    setStep(id);
  }, []);
  const advanceFrom = useCallback((from: StepId) => {
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => setStep(STEPS[Math.min(STEPS.findIndex((s) => s.id === from) + 1, STEPS.length - 1)].id), ADVANCE_MS);
  }, []);

  const toggleBackground = useCallback(
    (id: string) => {
      const current = loadSelection();
      const next = { ...current, backgroundId: current.backgroundId === id ? null : id };
      update(next);
      if (next.backgroundId) advanceFrom('background');
    },
    [update, advanceFrom]
  );
  const togglePose = useCallback(
    (id: string) => {
      const current = loadSelection();
      const next = { ...current, poseId: current.poseId === id ? null : id };
      update(next);
      if (next.poseId) advanceFrom('pose');
    },
    [update, advanceFrom]
  );
  const toggleProp = useCallback(
    (id: string) => {
      const current = loadSelection();
      if (current.propIds.includes(id)) {
        update({ ...current, propIds: current.propIds.filter((p) => p !== id) });
      } else if (current.propIds.length >= MAX_PROPS) {
        toast({ title: '소품은 ' + MAX_PROPS + '개까지 고를 수 있어요', description: '위의 소품 칸에서 하나를 빼고 다시 골라 주세요.' });
      } else {
        update({ ...current, propIds: [...current.propIds, id] });
      }
    },
    [update, toast]
  );

  const background = findBackground(selection.backgroundId);
  const pose = findPose(selection.poseId);
  const props = useMemo(() => selection.propIds.map((id) => findProp(id)).filter((p): p is Preset => Boolean(p)), [selection.propIds]);
  const done: Record<StepId, boolean> = { background: Boolean(background), pose: Boolean(pose), prop: props.length > 0 };
  const hasChoice = done.background || done.pose || done.prop;

  const restart = useCallback(() => {
    clearSession();
    router.push('/');
  }, [router]);

  const generate = async () => {
    if (!photo || generating || !hasChoice) return;
    setGenerating(true);
    try {
      const res = await generatePhotoAction({ photo, ...selection });
      if (res.ok) {
        setResult(res.image);
        setResultState(res.image);
      } else {
        toast({ variant: 'destructive', title: '사진을 만들지 못했어요', description: res.error });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '연결이 끊겼어요', description: '인터넷 연결을 확인하고 다시 눌러 주세요.' });
    } finally {
      setGenerating(false);
    }
  };

  if (!photo) return null;

  if (result) {
    return (
      <main className="flex h-dvh flex-col gap-4 p-4 md:p-6">
        <ResultView
          image={result}
          original={photo}
          summary={[background?.name, pose?.name, ...props.map((p) => p.name)].filter(Boolean).join(' · ')}
          onRestart={restart}
          onRetry={() => {
            setResult(null);
            setResultState(null);
            goTo('background');
          }}
        />
      </main>
    );
  }

  const current = STEPS[stepIndex];
  const nextStep = STEPS[stepIndex + 1];

  return (
    <main className="flex h-dvh flex-col gap-3 p-3 md:gap-4 md:p-5">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" onClick={() => clearSession()} className="btn-ghost min-h-11 px-4 py-2 text-base">
          <Home className="size-5" aria-hidden /> <span className="hidden sm:inline">처음으로</span>
        </Link>
        <nav aria-label="만들기 단계" className="flex items-center gap-1 rounded-full border border-white/10 bg-black/25 p-1">
          {STEPS.map((s, i) => {
            const active = step === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(s.id)}
                aria-current={active ? 'step' : undefined}
                className={cn('step-pill', active ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:text-foreground')}
              >
                <span
                  className={cn(
                    'step-dot',
                    active ? 'border-primary-foreground/40' : done[s.id] ? 'border-accent bg-accent text-accent-foreground' : 'border-white/25'
                  )}
                >
                  {done[s.id] && !active ? <Check className="size-4" strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                {s.label}
              </button>
            );
          })}
        </nav>
        <Link href="/booth" className="btn-ghost min-h-11 px-4 py-2 text-base" aria-label="사진 다시 찍기">
          <Camera className="size-5" aria-hidden /> <span className="hidden sm:inline">다시 찍기</span>
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(12rem,15rem)_1fr] md:gap-5 lg:grid-cols-[minmax(15rem,19rem)_1fr]">
        {/* My look: the photo and every current pick, always visible. */}
        <aside aria-label="내가 고른 것" className="panel hidden min-h-0 flex-col gap-4 p-4 md:flex">
          <div className="relative min-h-0 flex-1">
            <img src={photo} alt="내 사진" className="absolute inset-0 m-auto h-full max-h-full w-auto max-w-full rounded-2xl object-cover shadow-xl" />
          </div>
          <div className="space-y-2">
            <p className="font-display text-lg text-foreground/80">내가 고른 것</p>
            <div className="grid grid-cols-5 gap-2">
              <button type="button" onClick={() => goTo('background')} className="col-span-1" aria-label="배경 다시 고르기">
                <TraySlot item={background} variant="background" placeholder="배경" />
              </button>
              <button type="button" onClick={() => goTo('pose')} className="col-span-1" aria-label="동작 다시 고르기">
                <TraySlot item={pose} variant="pose" placeholder="동작" />
              </button>
              {Array.from({ length: MAX_PROPS }, (_, i) => (
                <TraySlot key={i} item={props[i]} variant="prop" placeholder={'소품 ' + (i + 1)} onClear={props[i] ? () => toggleProp(props[i].id) : undefined} />
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col gap-3" aria-labelledby="step-title">
          {/* Compact pick strip for narrow screens, where the side panel is hidden. */}
          <div className="flex items-center gap-2 md:hidden" aria-label="내가 고른 것">
            <img src={photo} alt="내 사진" className="h-14 w-auto rounded-xl object-cover" />
            <div className="grid flex-1 grid-cols-5 gap-1.5">
              <TraySlot item={background} variant="background" placeholder="배경" />
              <TraySlot item={pose} variant="pose" placeholder="동작" />
              {Array.from({ length: MAX_PROPS }, (_, i) => (
                <TraySlot key={i} item={props[i]} variant="prop" placeholder={'소품' + (i + 1)} onClear={props[i] ? () => toggleProp(props[i].id) : undefined} />
              ))}
            </div>
          </div>
          <div key={step} className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 animate-rise">
            <h1 id="step-title" className="font-display text-3xl text-foreground md:text-4xl">
              <span className="text-primary">{current.label}</span> · {current.title}
            </h1>
            <p className="text-base text-muted-foreground md:text-lg">{current.hint}</p>
          </div>
          {step === 'background' && (
            <PresetGrid
              label="배경"
              variant="background"
              items={BACKGROUNDS}
              categories={BACKGROUND_CATEGORIES}
              selected={selection.backgroundId ? [selection.backgroundId] : []}
              onToggle={toggleBackground}
            />
          )}
          {step === 'pose' && (
            <PresetGrid label="동작" variant="pose" items={POSES} categories={POSE_CATEGORIES} selected={selection.poseId ? [selection.poseId] : []} onToggle={togglePose} />
          )}
          {step === 'prop' && (
            <PresetGrid
              label="소품"
              variant="prop"
              items={PROPS}
              categories={PROP_CATEGORIES}
              selected={selection.propIds}
              onToggle={toggleProp}
              full={selection.propIds.length >= MAX_PROPS}
            />
          )}
        </section>
      </div>

      <footer className="panel flex items-center justify-between gap-3 p-2 pl-3 md:p-3">
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost min-h-12 px-4" onClick={() => goTo(STEPS[Math.max(stepIndex - 1, 0)].id)} disabled={stepIndex === 0}>
            <ArrowLeft className="size-5" aria-hidden /> <span className="hidden sm:inline">이전</span>
          </button>
          {nextStep && (
            <button type="button" className="btn-ghost min-h-12 whitespace-nowrap px-4" onClick={() => goTo(nextStep.id)}>
              <span className="sm:hidden">{done[current.id] ? '다음' : '건너뛰기'}</span>
              <span className="hidden sm:inline">{done[current.id] ? nextStep.label + ' 고르기' : current.label + ' 없이 넘어가기'}</span>
              <ArrowRight className="size-5" aria-hidden />
            </button>
          )}
        </div>
        <button type="button" className="btn-primary min-h-14 whitespace-nowrap px-5 text-xl sm:px-7 sm:text-2xl md:px-10" onClick={generate} disabled={!hasChoice || generating}>
          <Sparkles className="size-6 sm:size-7" aria-hidden />
          <span className="sm:hidden">만들기</span>
          <span className="hidden sm:inline">AI 사진 만들기</span>
          <span className="hidden rounded-full bg-black/10 px-2.5 py-0.5 text-base lg:inline">약 20초</span>
        </button>
      </footer>

      {generating && <GeneratingOverlay photo={photo} background={background?.thumb} />}
    </main>
  );
}
