import { Info } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TooltipHintProps {
  content: React.ReactNode;
}

/**
 * "这个配置项是做什么的 + 为什么这么设计" 提示 —— spec §1 全局 UI 原则。
 * 用一个小 info 图标，hover 时弹出 popover。
 */
export function TooltipHint({ content }: TooltipHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-3.5 w-3.5 items-center justify-center text-muted hover:text-text"
          aria-label="说明"
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
}
