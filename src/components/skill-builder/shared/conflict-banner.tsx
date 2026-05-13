import { AlertTriangle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Conflict, ConflictSeverity, SkillConfig } from '@/types/skill';

interface ConflictBannerProps {
  conflicts: Conflict[];
  /** 冲突卡片点击后跳转到的目标模块；调用方决定路径映射 */
  onJump?: (source: keyof SkillConfig) => void;
}

const SEVERITY_TONE: Record<
  ConflictSeverity,
  { border: string; bg: string; icon: typeof AlertTriangle; iconClass: string }
> = {
  error: {
    border: 'border-danger/40',
    bg: 'bg-danger/[0.06]',
    icon: XCircle,
    iconClass: 'text-danger',
  },
  warning: {
    border: 'border-warning/40',
    bg: 'bg-warning/[0.06]',
    icon: AlertTriangle,
    iconClass: 'text-warning',
  },
  info: {
    border: 'border-border',
    bg: 'bg-bg',
    icon: AlertTriangle,
    iconClass: 'text-muted',
  },
};

/**
 * 冲突预警栏 —— spec §1 "冲突预警必须实时"。
 * 中间面板底部固定栏：
 * - 0 个冲突：绿色「暂无冲突」
 * - ≥1 个：按 severity 着色 + 展开列表，每条可点击跳转到来源模块
 */
export function ConflictBanner({ conflicts, onJump }: ConflictBannerProps) {
  if (conflicts.length === 0) {
    return (
      <div className="flex items-center gap-2 border-t border-border bg-surface px-6 py-3 text-[12px] text-muted">
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        <span>冲突检查：暂无冲突</span>
      </div>
    );
  }

  const errorCount = conflicts.filter((c) => c.severity === 'error').length;
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length;

  return (
    <div className="max-h-[40vh] overflow-y-auto border-t border-warning/30 bg-warning/5 px-6 py-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
        <span className="text-[12px] font-semibold text-text">
          检测到 {conflicts.length} 处规则冲突
        </span>
        <span className="text-[11px] text-muted">
          {errorCount > 0 && `${errorCount} 个错误`}
          {errorCount > 0 && warningCount > 0 && ' · '}
          {warningCount > 0 && `${warningCount} 个警告`}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {conflicts.map((c) => {
          const tone = SEVERITY_TONE[c.severity];
          const Icon = tone.icon;
          const clickable = Boolean(onJump);
          return (
            <li
              key={c.id}
              className={cn(
                'rounded-md border bg-surface',
                tone.border,
                tone.bg,
                clickable && 'transition-colors hover:bg-surface',
              )}
            >
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onJump?.(c.source)}
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-2 text-left',
                  clickable && 'cursor-pointer',
                )}
              >
                <Icon
                  className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', tone.iconClass)}
                />
                <div className="flex-1">
                  <div className="text-[12px] font-medium text-text">
                    {c.title}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-muted">
                    {c.detail}
                  </div>
                </div>
                {clickable && (
                  <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-muted">
                    跳转到 {sourceLabel(c.source)}
                    <ArrowRight className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function sourceLabel(source: keyof SkillConfig): string {
  switch (source) {
    case 'metadata':
      return '元信息';
    case 'triggers':
      return '触发方式';
    case 'filters':
      return '筛选规则';
    case 'actions':
      return '动作配置';
    case 'automationBoundary':
      return '自动化边界';
    case 'modelRouting':
      return '模型路由';
    case 'knowledgeRetrieval':
      return '知识检索';
    default:
      return source;
  }
}
