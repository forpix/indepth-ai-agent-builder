import { useMemo } from 'react';
import { ArrowRight, FileSearch } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { MOCK_PURCHASE_ORDERS } from '@/mocks/purchase-orders';
import { resolveOrderIds, useScenarioStore } from '@/stores/scenario-store';
import type { TraceLog } from '@/types/agent';
import type { PurchaseOrder } from '@/types/mock-data';

export function TraceDetail() {
  const traces = useScenarioStore((s) => s.traces);
  const selectedTraceId = useScenarioStore((s) => s.selectedTraceId);

  const trace = useMemo(() => {
    if (!selectedTraceId) return null;
    return traces.find((t) => t.id === selectedTraceId) ?? null;
  }, [traces, selectedTraceId]);

  if (!trace) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <FileSearch className="h-6 w-6 text-muted opacity-40" />
        <div className="text-[12px] text-text">
          {traces.length === 0
            ? '尚无 trace 可查看'
            : '从左侧选择一条 Trace 查看详情'}
        </div>
        {traces.length > 0 && (
          <div className="text-[10px] text-muted">
            共 {traces.length} 条 trace 待审查
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TraceHeader trace={trace} />
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <TraceInputOutput trace={trace} />
        <RelatedOrderCard trace={trace} />
      </div>
    </div>
  );
}

function TraceHeader({ trace }: { trace: TraceLog }) {
  return (
    <div className="border-b border-border bg-surface px-5 py-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
        <span className="font-mono text-[11px] text-muted">{trace.id}</span>
        <Badge tone="primary">{traceTypeLabel(trace.type)}</Badge>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted">
        <span>Step {trace.step}</span>
        <span>+{trace.timestamp}ms</span>
        {trace.modelUsed && <span>Model: {trace.modelUsed}</span>}
        {trace.tokenUsed !== undefined && <span>Token: {trace.tokenUsed}</span>}
        {trace.latencyMs !== undefined && <span>Latency: {trace.latencyMs}ms</span>}
        {trace.actorId && <span>actorId: {trace.actorId}</span>}
        {trace.authorizationResult && (
          <span>auth: {trace.authorizationResult}</span>
        )}
      </div>
    </div>
  );
}

function TraceInputOutput({ trace }: { trace: TraceLog }) {
  return (
    <>
      <Section title="Input">
        <KVList data={trace.input as Record<string, unknown>} />
      </Section>
      <Section title="Output">
        <KVList data={trace.output as Record<string, unknown>} />
      </Section>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-bg/30">
      <div className="border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </div>
      <div className="px-3 py-2 font-mono text-[10px] leading-relaxed text-text">
        {children}
      </div>
    </div>
  );
}

function KVList({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <span className="text-muted">（空）</span>;
  }
  return (
    <div className="space-y-0.5">
      {entries.map(([k, v]) => (
        <div key={k} className="break-words">
          <span className="text-muted">{k}:</span>{' '}
          <span className="text-text">{formatValue(v)}</span>
        </div>
      ))}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    if (v.every((x) => typeof x === 'string')) {
      return `[${v.map((x) => JSON.stringify(x)).join(', ')}]`;
    }
    return JSON.stringify(v, null, 2);
  }
  if (typeof v === 'object') {
    return JSON.stringify(v, null, 2);
  }
  return String(v);
}

function RelatedOrderCard({ trace }: { trace: TraceLog }) {
  const navigate = useNavigate();
  const setHighlightedOrder = useScenarioStore((s) => s.setHighlightedOrder);

  const orderIds = resolveOrderIds(trace);
  if (orderIds.length === 0) return null;
  const firstId = orderIds[0];
  if (!firstId) return null;

  const order = MOCK_PURCHASE_ORDERS[firstId] ?? null;
  if (!order) return null;

  const extraCount = orderIds.length - 1;

  const handleJumpToAC = () => {
    setHighlightedOrder(firstId);
    void navigate({ to: '/agent-console' });
    // 3 秒后自动清除高亮
    window.setTimeout(() => {
      // 仅当目前还是这个 id 时才清，避免覆盖用户后续点的别的订单
      const current = useScenarioStore.getState().highlightedOrderId;
      if (current === firstId) {
        useScenarioStore.getState().setHighlightedOrder(null);
      }
    }, 3000);
  };

  return (
    <Section title="关联订单">
      <OrderSnippet order={order} />
      {extraCount > 0 && (
        <div className="mt-1 text-[10px] text-muted">
          及 {extraCount} 条其他订单：{orderIds.slice(1).join('、')}
        </div>
      )}
      <button
        type="button"
        onClick={handleJumpToAC}
        className="mt-2 inline-flex items-center gap-1 text-[10px] text-accent hover:underline"
      >
        <ArrowRight className="h-2.5 w-2.5" />在 Agent Console 查看此订单
      </button>
    </Section>
  );
}

function OrderSnippet({ order }: { order: PurchaseOrder }) {
  const tags: string[] = [];
  if (order.isCritical === 'yes') tags.push('关键件');
  if (order.isSingleSource === 'yes') tags.push('单一来源');
  if (order.affectedWorkOrderIds.length > 0)
    tags.push(`影响 ${order.affectedWorkOrderIds.length} 张工单`);
  if (order.customerImportance === 'KA') tags.push('KA 客户');

  return (
    <div className="space-y-0.5 text-[11px] text-text">
      <div className="font-mono text-[10px] text-muted">
        {order.id} · {order.materialCode}
      </div>
      <div>
        {order.materialName} · ¥{order.amount.toLocaleString()}
      </div>
      <div className="text-[10px] text-muted">
        供应商：{order.supplierName}（{order.supplierTier} 级）
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[9px] text-muted"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function traceTypeLabel(t: TraceLog['type']): string {
  switch (t) {
    case 'intent':
      return '意图 / IntentTrace';
    case 'filter':
      return '筛选 / FilterTrace';
    case 'risk':
      return '风险 / RiskTrace';
    case 'call-skill':
      return '子 Skill / CallSkillTrace';
    case 'human-decision':
      return '人工决策 / HumanDecisionTrace';
    case 'config-change':
      return '配置变更 / ConfigChangeTrace';
  }
}

