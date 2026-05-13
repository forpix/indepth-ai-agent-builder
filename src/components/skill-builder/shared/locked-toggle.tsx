import { Lock } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface LockedToggleProps {
  /** 安全层永远是 true，但保留 prop 以便未来扩展 */
  checked?: boolean;
  reason: React.ReactNode;
}

/**
 * 锁定状态的 Toggle（PD-3 安全层专用）。
 * UI 上呈现为"开启"的样子，但鼠标尝试点击会显示 tooltip 说明为什么不可关。
 * cursor: not-allowed + hover 解释 —— 是用产品约束代替用户脑力的可见化。
 */
export function LockedToggle({ checked = true, reason }: LockedToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'inline-flex h-[20px] w-[36px] cursor-not-allowed items-center rounded-full border border-transparent',
            checked ? 'bg-primary/60' : 'bg-border',
          )}
          aria-label="安全层规则不可关闭"
        >
          <div
            className={cn(
              'flex h-[16px] w-[16px] items-center justify-center rounded-full bg-white shadow transition-transform',
              checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
            )}
          >
            <Lock className="h-2.5 w-2.5 text-primary" />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
