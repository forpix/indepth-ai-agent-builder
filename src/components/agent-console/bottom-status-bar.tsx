import { BarChart3, FileSearch } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import { useScenarioStore, selectHud } from '@/stores/scenario-store';

export function BottomStatusBar() {
  const hud = useScenarioStore(useShallow(selectHud));
  const currentStep = useScenarioStore((s) => s.currentStep);
  const isDone = currentStep === 'done';

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-t border-border bg-surface px-6 text-[11px]">
      <div className="flex items-center gap-4 tabular-nums">
        <span className="flex items-center gap-1 text-muted">
          <BarChart3 className="h-3 w-3" />
          实时 HUD
        </span>
        <KV label="Token" value={hud.totalTokens.toLocaleString()} />
        <KV label="成本" value={`¥${hud.cost.toFixed(2)}`} />
        <KV label="平均延迟" value={`${hud.avgLatencyMs} ms`} />
      </div>

      <Button
        variant={isDone ? 'primary' : 'ghost'}
        size="sm"
        disabled={!isDone}
        onClick={isDone ? () => useScenarioStore.getState().openReviewModal() : undefined}
        title={isDone ? '查看本次决策路径复盘' : '剧本结束后高亮（X4）'}
        className={isDone ? 'animate-pulse' : undefined}
      >
        <FileSearch className="h-3 w-3" />
        一键复盘
      </Button>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-muted">{label}</span>
      <span className="font-mono font-medium text-text">{value}</span>
    </span>
  );
}
