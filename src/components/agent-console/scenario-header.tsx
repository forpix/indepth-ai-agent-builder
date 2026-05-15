import { Play, ChevronRight, RotateCcw, Sparkles, Square, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SCENARIO_STEP_INDEX } from '@/types/agent';
import { useScenarioStore } from '@/stores/scenario-store';
import { isRealLlmEnabled } from '@/hooks/use-real-llm';

const STEP_LABEL: Record<number, string> = {
  0: '等待启动',
  1: '08:00 定时触发',
  2: '扫描 + 流式分析',
  3: '安全层拦截 + 多智能体协同',
  4: '采购员追问 → 规则优先级',
  5: '反向调参 / 自动重跑',
  6: '剧本完成 — 一键复盘',
};

export function ScenarioHeader() {
  const currentStep = useScenarioStore((s) => s.currentStep);
  const isAutoPlaying = useScenarioStore((s) => s.isAutoPlaying);
  const start = useScenarioStore((s) => s.start);
  const next = useScenarioStore((s) => s.next);
  const reset = useScenarioStore((s) => s.reset);
  const startAutoPlay = useScenarioStore((s) => s.startAutoPlay);
  const cancelAutoPlay = useScenarioStore((s) => s.cancelAutoPlay);

  const stepIndex = SCENARIO_STEP_INDEX[currentStep];
  const label = STEP_LABEL[stepIndex] ?? '剧本中';
  const isIdle = currentStep === 'idle';
  const isDone = currentStep === 'done';
  const realLlm = isRealLlmEnabled();

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-3 text-[12px]">
        <span className="text-muted">当前剧本</span>
        <span className="font-medium text-text">{label}</span>
        {!isIdle && (
          <span className="text-muted">
            · 第 <span className="font-medium text-text">{stepIndex}</span> 步 / 6
          </span>
        )}
        {isAutoPlaying && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            演示模式自动播放中
          </span>
        )}
        {realLlm && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] text-danger"
            title="?real-llm=<token> 检测到，关键决策走真 LLM (moonshot-v1-32k)。失败时静默 fallback mock"
          >
            <Zap className="h-2.5 w-2.5" />
            真 LLM · moonshot-v1-32k
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isAutoPlaying ? (
          <Button variant="danger" size="sm" onClick={cancelAutoPlay}>
            <Square className="h-3.5 w-3.5" />
            停止演示
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={startAutoPlay}
            title="一键自动播完整个 6 步复合剧本（含伪鼠标光标演示 PD-8）"
          >
            <Sparkles className="h-3.5 w-3.5" />
            演示模式
          </Button>
        )}

        {isIdle && !isAutoPlaying && (
          <Button variant="primary" size="md" onClick={start}>
            <Play className="h-3.5 w-3.5" />
            启动剧本
          </Button>
        )}

        {!isIdle && !isDone && !isAutoPlaying && (
          <>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
              重置
            </Button>
            <Button variant="primary" size="md" onClick={next}>
              下一步
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {isDone && !isAutoPlaying && (
          <>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
              重新开始
            </Button>
            <span className="rounded-md bg-success/10 px-2 py-1 text-[11px] text-success">
              ✓ 剧本完成
            </span>
          </>
        )}
      </div>
    </div>
  );
}
