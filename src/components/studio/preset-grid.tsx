'use client';

import { memo, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { Preset, PresetCategory } from '@/lib/presets';
import { cn } from '@/lib/utils';

type Props = {
  items: Preset[];
  categories: PresetCategory[];
  selected: string[];
  onToggle: (id: string) => void;
  variant: 'background' | 'pose' | 'prop';
  label: string;
};

const PresetCard = memo(function PresetCard({
  item,
  active,
  variant,
  onToggle,
}: {
  item: Preset;
  active: boolean;
  variant: Props['variant'];
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      aria-pressed={active}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-card text-left transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 active:scale-95',
        active ? 'border-primary' : 'border-transparent'
      )}
    >
      <span
        className={cn('relative block w-full overflow-hidden', variant === 'background' ? 'aspect-[4/5]' : 'aspect-square bg-white')}
      >
        <img
          src={item.thumb}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn('size-full', variant === 'background' ? 'object-cover' : 'object-contain p-1')}
        />
        {active && (
          <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-5" aria-hidden />
          </span>
        )}
      </span>
      <span className="px-3 py-2 font-display text-lg leading-tight">{item.name}</span>
    </button>
  );
});

export function PresetGrid({ items, categories, selected, onToggle, variant, label }: Props) {
  const [category, setCategory] = useState<string>('all');
  const visible = useMemo(() => (category === 'all' ? items : items.filter((i) => i.category === category)), [items, category]);
  const columns = variant === 'background' ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 xl:grid-cols-5';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div role="tablist" aria-label={label + ' 분류'} className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
        {[{ id: 'all', label: '전체' }, ...categories].map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn('chip', category === c.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-white/10')}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <div className={cn('grid gap-3 pb-4', columns)}>
          {visible.map((item) => (
            <PresetCard key={item.id} item={item} active={selected.includes(item.id)} variant={variant} onToggle={onToggle} />
          ))}
        </div>
      </div>
    </div>
  );
}
