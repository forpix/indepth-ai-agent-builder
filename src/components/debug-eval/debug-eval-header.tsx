import { ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { useScenarioStore } from '@/stores/scenario-store';

export function DebugEvalHeader() {
  const navigate = useNavigate();
  const tracesCount = useScenarioStore((s) => s.traces.length);
  const startedAt = useScenarioStore((s) => s.startedAt);

  const sourceText =
    tracesCount === 0
      ? '尚无 trace · 请先到 Agent Console 启动剧本'
      : `本次剧本 ${tracesCount} 条 trace${startedAt ? ` · 始于 ${formatTime(startedAt)}` : ''}`;

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-3 text-[12px]">
        <span className="text-muted">数据源</span>
        <span className="text-text">{sourceText}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled
          title="P2 实装：导出全部 trace 为 JSON 文件"
        >
          <Download className="h-3.5 w-3.5" />
          导出 JSON
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void navigate({ to: '/agent-console' })}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回 Agent Console
        </Button>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
