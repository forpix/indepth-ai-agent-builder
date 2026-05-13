import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

interface PillOption<T extends string> {
  value: T;
  label: string;
}

interface PillSelectorProps<T extends string> {
  options: PillOption<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
}

/**
 * 多选 Pill —— B 端短选项列表（3-5 项）的最舒适形态。
 * 比 Multi-select dropdown 直观：所有可能值一眼可见。
 * 选中态用 primary 描边 + check 图标，未选中保持中性灰。
 */
export function PillSelector<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: PillSelectorProps<T>) {
  const selected = new Set(value);

  const toggle = (key: T) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            disabled={disabled}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[12px] transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-60',
              active
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-surface text-muted hover:text-text',
            )}
          >
            {active && <Check className="h-3 w-3" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
