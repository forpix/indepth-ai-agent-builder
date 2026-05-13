import { cn } from '@/lib/utils';

interface ConfigCardProps {
  title: string;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  /** 右上角附加内容，比如联动状态徽标 */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * 配置卡片 —— spec §4.1 用"分组的配置卡片"代替拖拽画布（呼应 PD-1）。
 * 每个分组（时间筛选 / 供应商筛选 等）是一张卡。
 */
export function ConfigCard({
  title,
  icon,
  hint,
  action,
  children,
  className,
}: ConfigCardProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-surface',
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted">{icon}</span>}
          <h3 className="text-[13px] font-semibold text-text">{title}</h3>
          {hint && (
            <span className="text-[11px] text-muted">{hint}</span>
          )}
        </div>
        {action}
      </header>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}
