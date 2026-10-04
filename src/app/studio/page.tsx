'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Home, Sparkles, X } from 'lucide-react';
import { generatePhotoAction } from '@/app/actions';
import { applyLensEffect, preloadLensEffect } from '@/lib/lens-effects';
import { GeneratingOverlay } from '@/components/studio/generating-overlay';
import { PresetGrid } from '@/components/studio/preset-grid';
import { ResultView } from '@/components/studio/result-view';
import {
  BACKGROUND_CATEGORIES,
  BACKGROUNDS,
  COMPOSITION_CATEGORIES,
  COMPOSITIONS,
  MAX_PROPS,
  POSE_CATEGORIES,
  POSES,
  PROP_CATEGORIES,
  PROPS,
  findBackground,
  findComposition,
  findPose,
  findProp,
} from '@/lib/presets';
import { EMPTY_SELECTION, clearSession, getPhoto, getResult, loadSelection, saveSelection, setResult, type Selection } from '@/lib/session';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'background', label: '배경', hint: '어디에서 찍을까요?' },
  { id: 'pose', label: '동작', hint: '어떤 포즈를 할까요?' },
  { id: 'prop', label: '소품', hint: '최대 ' + MAX_PROPS + '개, 고르면 잠시 뒤 구도로 넘어가요.' },
  { id: 'composition', label: '구도', hint: '고르면 바로 AI 사진을 만들어요.' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

// Event flow: every pick moves the visitor on by itself. Props allow several picks, so the
// move to the composition step waits a moment after the last pick (or goes at once at the limit).
const AUTO_NEXT_MS = 180;
const PROP_ADVANCE_MS = 1500;

export default function StudioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [photo, setPhotoState] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [step, setStep] = useState<StepId>('background');
  const [generating, setGenerating] = useState(false);
  const [result, setResultState] = useState<string | null>(null);
  const [propAdvancing, setPropAdvancing] = useState(false);
  const propTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generatingRef = useRef(false);

  useEffect(() => {
    const saved = getPhoto();
    if (!saved) {
      router.replace('/booth');
      return;
    }
    setPhotoState(saved);
    setSelection(loadSelection());
    setResultState(getResult());
  }, [router]);

  const update = useCallback((next: Selection) => {
    setSelection(next);
    saveSelection(next);
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const goNext = useCallback(() => setStep((s) => STEPS[Math.min(STEPS.findIndex((x) => x.id === s) + 1, STEPS.length - 1)].id), []);

  const toggleBackground = useCallback(
    (id: string) => {
      const next = { ...loadSelection(), backgroundId: loadSelection().backgroundId === id ? null : id };
      update(next);
      if (next.backgroundId) setTimeout(goNext, 180);
    },
    [update, goNext]
  );
  const togglePose = useCallback(
    (id: string) => {
      const next = { ...loadSelection(), poseId: loadSelection().poseId === id ? null : id };
      update(next);
      if (next.poseId) setTimeout(goNext, 180);
    },
    [update, goNext]
  );
  const toggleProp = useCallback(
    (id: string) => {
      const current = loadSelection();
      let next = current.propIds;
      if (current.propIds.includes(id)) {
        next = current.propIds.filter((p) => p !== id);
      } else if (current.propIds.length >= MAX_PROPS) {
        toast({ title: '소품은 ' + MAX_PROPS + '개까지 고를 수 있어요.' });
        return;
      } else {
        next = [...current.propIds, id];
      }
      update({ ...current, propIds: next });
      if (propTimer.current) clearTimeout(propTimer.current);
      propTimer.current = null;
      setPropAdvancing(false);
      if (next.length === 0) return;
      // Only moves on if the visitor is still on the prop step when the timer fires.
      const advance = () => {
        propTimer.current = null;
        setPropAdvancing(false);
        setStep((s) => (s === 'prop' ? 'composition' : s));
      };
      if (next.length >= MAX_PROPS) {
        propTimer.current = setTimeout(advance, AUTO_NEXT_MS);
      } else {
        setPropAdvancing(true);
        propTimer.current = setTimeout(advance, PROP_ADVANCE_MS);
      }
    },
    [update, toast]
  );
  useEffect(() => {
    if (step !== 'prop' && propTimer.current) {
      clearTimeout(propTimer.current);
      propTimer.current = null;
      setPropAdvancing(false);
    }
  }, [step]);
  useEffect(() => () => {
    if (propTimer.current) clearTimeout(propTimer.current);
  }, []);

  const generate = useCallback(async () => {
    if (!photo || generatingRef.current) return;
    // Read the stored selection so a pick made a moment ago is always included.
    const current = loadSelection();
    if (!current.backgroundId && !current.poseId && !current.propIds.length && !current.compositionId) return;
    generatingRef.current = true;
    setGenerating(true);
    preloadLensEffect(current.compositionId);
    try {
      const res = await generatePhotoAction({ photo, ...current });
      if (getPhoto() !== photo) return;
      if (res.ok) {
        // Lens effects (bokeh, panning, tilt-shift, soft focus) are finished here in the browser.
        const image = await applyLensEffect(res.image, current.compositionId);
        if (getPhoto() !== photo) return;
        setResult(image);
        setResultState(image);
      } else {
        toast({ variant: 'destructive', title: '만들지 못했어요', description: res.error });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '연결이 끊겼어요', description: '인터넷 연결을 확인하고 다시 시도해 주세요.' });
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }, [photo, toast]);

  // Picking a composition is the last choice: it selects (never unselects) and starts the AI.
  const chooseComposition = useCallback(
    (id: string) => {
      if (generatingRef.current) return;
      update({ ...loadSelection(), compositionId: id });
      setTimeout(generate, AUTO_NEXT_MS);
    },
    [update, generate]
  );
  const clearComposition = useCallback(() => update({ ...loadSelection(), compositionId: null }), [update]);
  const toggleFor = (target: StepId, id: string) => {
    if (target === 'background') toggleBackground(id);
    else if (target === 'pose') togglePose(id);
    else if (target === 'prop') toggleProp(id);
    else clearComposition();
  };

  const chosen = useMemo(
    () => [
      { step: 'background' as StepId, label: '배경', items: [findBackground(selection.backgroundId)].filter(Boolean) },
      { step: 'pose' as StepId, label: '동작', items: [findPose(selection.poseId)].filter(Boolean) },
      { step: 'prop' as StepId, label: '소품', items: selection.propIds.map((id) => findProp(id)).filter(Boolean) },
      { step: 'composition' as StepId, label: '구도', items: [findComposition(selection.compositionId)].filter(Boolean) },
    ],
    [selection]
  );
  const hasChoice = Boolean(selection.backgroundId || selection.poseId || selection.propIds.length || selection.compositionId);
  const nextLabel =
    step === 'background'
      ? selection.backgroundId ? '다음' : '배경 그대로'
      : step === 'pose'
        ? selection.poseId ? '다음' : '동작 없이'
        : propAdvancing ? '곧 구도로 넘어가요' : selection.propIds.length ? '다음' : '소품 없이';

  const restart = useCallback(() => {
    clearSession();
    setPhotoState(null);
    setResultState(null);
    router.push('/');
  }, [router]);

  if (!photo) return null;

  const current = STEPS[stepIndex];

  return (
    <main className="flex h-dvh flex-col gap-4 p-4 md:p-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" onClick={() => clearSession()} aria-label="처음으로" className="btn-ghost shrink-0 whitespace-nowrap px-3 py-2 text-base sm:px-4">
          <Home className="size-5" aria-hidden /> <span className="hidden sm:inline">처음으로</span>
        </Link>
        {!result && (
          <nav aria-label="단계" className="scrollbar-none flex min-w-0 gap-1 overflow-x-auto rounded-full bg-white/5 p-1">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                aria-current={step === s.id ? 'step' : undefined}
                className={cn(
                  'whitespace-nowrap rounded-full px-2.5 py-2 font-display text-base transition-colors sm:px-6 sm:text-lg',
                  step === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {i + 1}. {s.label}
              </button>
            ))}
          </nav>
        )}
        <span className="hidden w-28 sm:block" aria-hidden />
      </header>

      {result ? (
        <ResultView
          image={result}
          choices={selection}
          onRestart={restart}
          onRetry={() => {
            setResult(null);
            setResultState(null);
            setStep('background');
          }}
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[minmax(14rem,20rem)_1fr] lg:gap-6">
          <aside className="panel hidden min-h-0 flex-col gap-4 p-4 md:flex">
            <img src={photo} alt="내 사진" className="mx-auto aspect-[2/3] max-h-[42dvh] w-auto rounded-2xl object-cover" />
            <ul className="flex flex-col gap-2">
              {chosen.map((group) => (
                <li key={group.step} className="flex items-start gap-2">
                  <button type="button" onClick={() => setStep(group.step)} className="w-10 shrink-0 pt-1 text-left font-display text-accent">
                    {group.label}
                  </button>
                  <div className="flex flex-wrap gap-1">
                    {group.items.length ? (
                      group.items.map((item) => (
                        <button
                          key={item!.id}
                          type="button"
                          onClick={() => toggleFor(group.step, item!.id)}
                          className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
                          aria-label={item!.name + ' 선택 해제'}
                        >
                          {item!.name} <X className="size-3" aria-hidden />
                        </button>
                      ))
                    ) : (
                      <span className="pt-1 text-sm text-muted-foreground">선택 안 함</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          <section className="flex min-h-0 flex-col gap-3" aria-labelledby="step-title">
            <div className="flex items-baseline justify-between gap-3">
              <h1 id="step-title" className="font-display text-3xl text-primary">
                {current.label} 고르기
              </h1>
              <p className="text-muted-foreground">{current.hint}</p>
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
              <PresetGrid
                label="동작"
                variant="pose"
                items={POSES}
                categories={POSE_CATEGORIES}
                selected={selection.poseId ? [selection.poseId] : []}
                onToggle={togglePose}
              />
            )}
            {step === 'prop' && (
              <PresetGrid label="소품" variant="prop" items={PROPS} categories={PROP_CATEGORIES} selected={selection.propIds} onToggle={toggleProp} />
            )}
            {step === 'composition' && (
              <PresetGrid
                label="구도"
                variant="composition"
                items={COMPOSITIONS}
                categories={COMPOSITION_CATEGORIES}
                selected={selection.compositionId ? [selection.compositionId] : []}
                onToggle={chooseComposition}
              />
            )}
          </section>
        </div>
      )}

      {!result && (
        <footer className="flex items-start justify-between gap-3">
          <button type="button" className="btn-ghost whitespace-nowrap" onClick={() => setStep(STEPS[Math.max(stepIndex - 1, 0)].id)} disabled={stepIndex === 0}>
            <ArrowLeft className="size-5" aria-hidden /> 이전
          </button>
          <div className="flex flex-1 flex-wrap justify-end gap-3">
            {stepIndex < STEPS.length - 1 && (
              <button type="button" className={cn('btn-ghost whitespace-nowrap', propAdvancing && step === 'prop' && 'animate-pulse ring-2 ring-primary')} onClick={goNext}>
                {nextLabel}
                <ArrowRight className="size-5" aria-hidden />
              </button>
            )}
            <button type="button" className="btn-primary whitespace-nowrap px-5 max-sm:w-full sm:px-8" onClick={generate} disabled={!hasChoice || generating}>
              <Sparkles className="size-6" aria-hidden /> AI 사진 만들기
            </button>
          </div>
        </footer>
      )}

      {generating && <GeneratingOverlay photo={photo} />}
    </main>
  );
}
