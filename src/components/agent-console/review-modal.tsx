import { useMemo } from 'react';
import { ArrowRight, FileSearch } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useShallow } from 'zustand/react/shallow';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useScenarioStore, selectHud } from '@/stores/scenario-store';

/**
 * X4 一键复盘 Modal —— Step 6 完成后右下角按钮触发。
 * 显示决策路径树（文本版，按 §12.4 取舍简化）+ 累计 HUD + Debug & Eval 跳转占位。
 */
export function ReviewModal() {
  const navigate = useNavigate();
  const showReviewModal = useScenarioStore((s) => s.showReviewModal);
  const closeReviewModal = useScenarioStore((s) => s.closeReviewModal);
  const setSelectedTrace = useScenarioStore((s) => s.setSelectedTrace);
  const traces = useScenarioStore((s) => s.traces);
  const runtimeRows = useScenarioStore((s) => s.runtimeRows);
  const hud = useScenarioStore(useShallow(selectHud));

  const handleJumpToDebugEval = () => {
    // 自动选中 trace-001（IntentTrace）—— 详见 debug_eval_spec §6.2.1
    const firstTrace = traces[0];
    if (firstTrace) setSelectedTrace(firstTrace.id);
    closeReviewModal();
    void navigate({ to: '/debug-eval' });
  };

  // 从 runtimeRows 分类生成路径树节点
  const summary = useMemo(() => {
    const safetyHumans: string[] = [];
    const autoApproved: string[] = [];
    const otherHuman: string[] = [];
    const missed: string[] = [];
    for (const row of Object.values(runtimeRows)) {
      if (row.status === 'autoApproved') autoApproved.push(row.orderId);
      else if (row.status === 'humanResolved') safetyHumans.push(row.orderId);
      else if (row.status === 'pendingHuman') otherHuman.push(row.orderId);
      else if (row.status === 'missed') missed.push(row.orderId);
    }
    return {
      safetyHumans: safetyHumans.sort(),
      autoApproved: autoApproved.sort(),
      otherHuman: otherHuman.sort(),
      missed: missed.sort(),
    };
  }, [runtimeRows]);

  const totalHit =
    summary.safetyHumans.length +
    summary.autoApproved.length +
    summary.otherHuman.length;

  return (
    <Dialog open={showReviewModal} onOpenChange={(o) => !o && closeReviewModal()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <FileSearch className="h-4 w-4 text-accent" />
            本次决策路径复盘
          </DialogTitle>
          <DialogDescription>
            90 秒复合剧本的 6 步完整决策链路（按 §10 Trace 反推）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* 路径树 */}
          <div className="rounded-md border border-border bg-bg/40 p-4 font-mono text-[11px] leading-relaxed">
            <div>10 条订单</div>
            <div className="ml-3">
              ├─ <span className="text-accent">{totalHit} 命中筛选</span>
            </div>

            <div className="ml-6">
              ├─ {summary.safetyHumans.length} 安全层覆盖 → 人工
            </div>
            {summary.safetyHumans.map((id, i) => (
              <div key={id} className="ml-9 text-muted">
                {i === summary.safetyHumans.length - 1 ? '└─' : '├─'} {id} 已派发主管
              </div>
            ))}

            <div className="ml-6">
              ├─ {summary.autoApproved.length} 业务层 / 调参后自动同意 → 任务卡
            </div>
            {summary.autoApproved.map((id, i) => (
              <div key={id} className="ml-9 text-muted">
                {i === summary.autoApproved.length - 1 ? '└─' : '├─'} {id} 已自动派发
              </div>
            ))}

            {summary.otherHuman.length > 0 && (
              <>
                <div className="ml-6">
                  └─ {summary.otherHuman.length} 命中但未处理 → 待人工
                </div>
                {summary.otherHuman.map((id, i) => (
                  <div key={id} className="ml-9 text-warning">
                    {i === summary.otherHuman.length - 1 ? '└─' : '├─'} {id} ⚠️ 未做人工决策
                  </div>
                ))}
              </>
            )}

            <div className="ml-3">
              └─ <span className="text-muted">{summary.missed.length} 未命中筛选</span>
            </div>
            {summary.missed.map((id, i) => (
              <div key={id} className="ml-6 text-muted">
                {i === summary.missed.length - 1 ? '└─' : '├─'} {id} （被筛选规则排除）
              </div>
            ))}
          </div>

          {/* HUD 收尾 */}
          <div className="grid grid-cols-3 gap-3 text-[11px]">
            <Stat label="累计 Token" value={hud.totalTokens.toLocaleString()} />
            <Stat label="估算成本" value={`¥${hud.cost.toFixed(2)}`} />
            <Stat label="平均延迟" value={`${hud.avgLatencyMs} ms`} />
          </div>

          {/* 跳转 Debug & Eval */}
          <div className="flex items-center justify-between rounded-md border border-accent/20 bg-accent/5 px-3 py-2.5 text-[11px]">
            <span className="text-text">
              想看每条 Trace 的完整内容？跳到 Debug &amp; Eval Tab。
            </span>
            <button
              type="button"
              onClick={handleJumpToDebugEval}
              className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
            >
              跳转到 Debug &amp; Eval
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="font-mono text-[13px] font-medium tabular-nums text-text">
        {value}
      </div>
    </div>
  );
}
