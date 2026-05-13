import { cn } from '@/lib/utils';
import type { Tristate } from '@/types/skill';

interface TristateSelectorProps {
  value: Tristate;
  onChange: (next: Tristate) => void;
  labels?: { yes: string; no: string; any: string };
}

/**
 * 三态选择器（PD-2 核心组件）——「是 / 否 / 不限」三段。
 *
 * 为什么不复用 RadioGroup：业务上这三个值是同级互斥的"段选项"而不是
 * 自由选 1（"不限"在交互语义上更接近 "不约束" 默认态）。
 * Segmented control 让 ISV 一眼看到所有可能值，比单选清楚。
 */
export function TristateSelector({
  value,
  onChange,
  labels = { yes: '是', no: '否', any: '不限' },
}: TristateSelectorProps) {
  const options: Array<{ key: Tristate; label: string }> = [
    { key: 'yes', label: labels.yes },
    { key: 'no', label: labels.no },
    { key: 'any', label: labels.any },
  ];

  return (
    <div
      role="radiogroup"
      className="inline-flex h-7 overflow-hidden rounded-md border border-border bg-surface"
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.key)}
            className={cn(
              'min-w-[52px] px-2.5 text-[12px] transition-colors',
              'border-r border-border last:border-r-0',
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface text-muted hover:bg-bg hover:text-text',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
