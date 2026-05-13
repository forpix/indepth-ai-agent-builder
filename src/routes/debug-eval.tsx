import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/debug-eval')({
  component: DebugEvalPage,
});

function DebugEvalPage() {
  return (
    <div className="grid h-full grid-cols-[1fr_360px]">
      <div className="flex flex-col border-r border-border p-6">
        <h3 className="text-[14px] font-semibold">Trace 面板</h3>
        <div className="mt-3 flex-1 rounded-lg border border-dashed border-border bg-surface p-6">
          <div className="text-[12px] text-muted">
            每一步执行的输入 / 输出 / 模型路由 / Token 消耗 / 知识检索命中。
            Phase 3 实现。
          </div>
        </div>
      </div>
      <div className="flex flex-col p-6">
        <h3 className="text-[14px] font-semibold">指标看板</h3>
        <div className="mt-3 flex-1 rounded-lg border border-dashed border-border bg-surface p-6">
          <div className="text-[12px] text-muted">
            指标全部标注「目标值（示意）」，不写「实测 92%」这种误导文字（PD-6）。
          </div>
        </div>
      </div>
    </div>
  );
}
