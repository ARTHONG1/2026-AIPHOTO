'use client';

import { memo, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { Preset, PresetCategory } from '@/lib/presets';
import { cn } from '@/lib/utils';

type Variant = 'background' | 'pose' | 'prop';

type Props = {
  items: Preset[];
  categories: PresetCategory[];
  selected: string[];
  onToggle: (id: string) => void;
  variant: Variant;
  label: string;
  /** Dims unselected cards (e.g. when the prop limit is reached). */
  full?: boolean;
};

const PresetCard = memo(function PresetCard({
  item,
  order,
  variant,
  dimmed,
  onToggle,
}: {
  item: Preset;
  /** 1-based pick order, 0 when not selected. */
  order: number;
  variant: Variant;
  dimmed: boolean;
  onToggle: (id: string) => void;
}) {
  const active = order > 0;
  return (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      aria-pressed={active}
      className={cn('preset-card group', active ? 'border-primary' : 'border-transparent hover:border-white/25', dimmed && 'opacity-45')}
    >
      <span
        className={cn(
          'relative block w-full overflow-hidden',
          variant === 'background' ? 'aspect-[4/5]' : 'aspect-square',
          variant === 'pose' && 'pose-stage',
          variant === 'prop' && 'bg-white'
        )}
      >
        <img
          src={item.thumb}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn(
            'size-full transition-transform duration-300 group-hover:scale-[1.04]',
            variant === 'background' ? 'object-cover' : variant === 'pose' ? 'object-contain p-2' : 'object-contain p-3'
          )}
        />
        {variant === 'background' && <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />}
        <span
          aria-hidden
          className={cn(
            'absolute right-2 top-2 flex size-9 items-center justify-center rounded-full font-display text-lg transition-[transform,opacity] duration-150',
            active ? 'scale-100 bg-primary text-primary-foreground opacity-100 shadow-lg' : 'scale-75 opacity-0'
          )}
        >
          {variant === 'prop' && active ? order : <Check className="size-5" strokeWidth={3} />}
        </span>
      </span>
      <span className={cn('px-3 py-2.5 font-display text-lg leading-tight', active ? 'text-primary' : 'text-foreground')}>{item.name}</span>
    </button>
  );
});

export function PresetGrid({ items, categories, selected, onToggle, variant, label, full = false }: Props) {
  const [category, setCategory] = useState<string>('all');
  const visible = useMemo(() => (category === 'all' ? items : items.filter((i) => i.category === category)), [items, category]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item.category, (map.get(item.category) ?? 0) + 1);
    return map;
  }, [items]);
  const columns =
    variant === 'background'
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'
      : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6';
  const tabs = [{ id: 'all', label: '전체', count: items.length }, ...categories.map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }))];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div role="tablist" aria-label={label + ' 분류'} className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn('chip flex items-center gap-2', category === c.id ? 'border-primary bg-primary text-primary-foreground' : 'text-foreground/85 hover:bg-white/10')}
          >
            {c.label}
            <span className={cn('rounded-full px-2 text-sm', category === c.id ? 'bg-black/15' : 'bg-white/10 text-foreground/60')}>{c.count}</span>
          </button>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-y-auto overscroll-contain pr-1">
          <div role="tabpanel" aria-label={label + ' 목록'} className={cn('grid gap-3 pb-6 md:gap-4', columns)}>
            {visible.map((item) => {
              const order = selected.indexOf(item.id) + 1;
              return <PresetCard key={item.id} item={item} order={order} variant={variant} dimmed={full && order === 0} onToggle={onToggle} />;
            })}
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#0c1030] to-transparent" />
      </div>
    </div>
  );
}
