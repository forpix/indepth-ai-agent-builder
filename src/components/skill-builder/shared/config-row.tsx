import { ShieldAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { TooltipHint } from './tooltip-hint';

interface ConfigRowProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  description?: React.ReactNode;
  /** 输入控件本体（Toggle / Slider / Select 等） */
  control: React.ReactNode;
  /** 控件下方附加说明，比如 cron 的人类可读描述 */
  trailing?: React.ReactNode;
  /** 整行禁用时的视觉提示（不传 disabled 给控件，由调用方自行管理） */
  disabled?: boolean;
  /**
   * 被另一层覆盖时的视觉降级（决策 D 选项 2）：
   * - label 加删除线
   * - 整行加 warning 边框 + 浅黄底
   * - 末尾加「被 X 覆盖」徽标
   * 控件本身保持可交互，因为规则"还在那里"，只是在当前场景下不生效。
   */
  overriddenBy?: string;
  className?: string;
}

/**
 * 配置项一行 —— 左侧 label + 可选说明 + 右侧控件。
 * 严格 12 列网格：label 占 5 列，控件占 7 列，PC 端不出现折行。
 */
export function ConfigRow({
  label,
  hint,
  description,
  control,
  trailing,
  disabled = false,
  overriddenBy,
  className,
}: ConfigRowProps) {
  const isOverridden = Boolean(overriddenBy);

  return (
    <div
      className={cn(
        'grid grid-cols-12 items-start gap-3 rounded-md transition-colors',
        disabled && 'opacity-50',
        isOverridden && 'border border-warning/40 bg-warning/5 px-3 py-2',
        className,
      )}
    >
      <div className="col-span-5 flex flex-col gap-0.5 pt-1">
        <div
          className={cn(
            'flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-text',
            isOverridden && 'text-muted line-through decoration-warning/60',
          )}
        >
          <span>{label}</span>
          {hint && <TooltipHint content={hint} />}
          {overriddenBy && (
            <span className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-surface px-1.5 py-0.5 text-[10px] font-medium text-[#92400E] no-underline">
              <ShieldAlert className="h-2.5 w-2.5" />
              被{overriddenBy}覆盖
            </span>
          )}
        </div>
        {description && (
          <span
            className={cn(
              'text-[11px] leading-relaxed text-muted',
              isOverridden && 'italic',
            )}
          >
            {description}
          </span>
        )}
      </div>
      <div className="col-span-7 flex flex-col gap-1">
        {control}
        {trailing && (
          <span className="text-[11px] text-muted">{trailing}</span>
        )}
      </div>
    </div>
  );
}
