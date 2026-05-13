import { createFileRoute } from '@tanstack/react-router';

import { ThreeColumnLayout } from '@/components/layout/three-column-layout';

export const Route = createFileRoute('/agent-console')({
  component: AgentConsolePage,
});

function AgentConsolePage() {
  return (
    <ThreeColumnLayout
      left={
        <PlaceholderColumn
          title="对话面板"
          description="Agent 与采购员的对话流，按 3 步固定剧本演示。Phase 2 实现。"
        />
      }
      center={
        <PlaceholderColumn
          title="订单表"
          description="10 条 mock 采购订单，覆盖普通跟催 / 高风险 / 二次跟催 / 单一来源等样本组合。"
        />
      }
      right={
        <PlaceholderColumn
          title="决策面板"
          description="展示 Agent 的意图、参数、Memory（PD-7：必须透明）。关键动作需人工确认（PD-8）。"
        />
      }
    />
  );
}

function PlaceholderColumn({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col p-6">
      <h3 className="text-[14px] font-semibold">{title}</h3>
      <div className="mt-3 flex-1 rounded-lg border border-dashed border-border bg-surface p-6">
        <div className="text-[12px] text-muted">{description}</div>
      </div>
    </div>
  );
}
