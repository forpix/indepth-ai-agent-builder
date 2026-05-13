import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Filter,
  Network,
  Play,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { runSkill, type RunResult } from '@/lib/skill-runner';
import { DEMO_SCENARIOS, getScenario } from '@/mocks/scenarios';
import { useSkillStore } from '@/stores/skill-store';
import { cn } from '@/lib/utils';
import type { PurchaseOrder } from '@/types/mock-data';

/**
 * 模拟运行 —— 右侧预览卡的核心组件 + 抽屉式结果面板。
 *
 * D-3：3 个预置场景按钮 + 1 个只读文本框（只展示不解析）。
 * 结果面板按 spec §10.2 的格式：筛选 / 安全层 / 业务层 / 动作派发四块。
 */
export function SimulationCard() {
  const config = useSkillStore((s) => s.config);
  const [scenarioId, setScenarioId] = useState<'A' | 'B' | 'C'>('A');
  const [result, setResult] = useState<RunResult | null>(null);
  const [open, setOpen] = useState(false);

  const scenario = useMemo(() => getScenario(scenarioId), [scenarioId]);

  const handleRun = () => {
    setResult(runSkill(config, scenario));
    setOpen(true);
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {DEMO_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenarioId(s.id)}
              className={cn(
                'rounded-md border px-2 py-1 text-[11px] transition-colors',
                scenarioId === s.id
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-surface text-muted hover:text-text',
              )}
            >
              场景 {s.id}
            </button>
          ))}
        </div>

        <Textarea
          value={scenario.narrative}
          readOnly
          className="min-h-[72px] resize-none text-[11px]"
        />

        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={handleRun}
        >
          <Play className="h-3 w-3" />
          运行当前 Skill
        </Button>

        <div className="text-[10px] leading-relaxed text-muted">
          结果基于当前 Skill 配置实时计算，不连真实数据库 / LLM。
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full max-w-[640px] flex-col p-0">
          {result ? <ResultPanel result={result} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ── 结果面板 ────────────────────────────────────────

function ResultPanel({ result }: { result: RunResult }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>模拟运行结果 · {result.scenario.title}</SheetTitle>
        <SheetDescription>
          基于当前 Skill 配置在 {result.totalOrders} 条订单上的执行链路推演
        </SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="rounded-md border border-border bg-bg/50 p-3 text-[12px] leading-relaxed text-muted">
          {result.scenario.narrative}
        </div>

        <ResultSection
          icon={<Filter className="h-3.5 w-3.5" />}
          title="命中筛选"
          count={result.filtered.length}
          total={result.totalOrders}
          tone="info"
        >
          {result.filtered.length === 0 ? (
            <Empty hint="所有订单都被过滤掉了，请检查筛选规则配置" />
          ) : (
            <OrderList orders={result.filtered} />
          )}
          {result.filteredOut.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-muted">
                已排除 {result.filteredOut.length} 条订单
              </summary>
              <ul className="mt-1 space-y-0.5 text-[11px] text-muted">
                {result.filteredOut.map(({ order, reason }) => (
                  <li key={order.id}>
                    {order.id}：{reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </ResultSection>

        <ResultSection
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          title="安全层强制人工"
          count={result.safetyOverride.length}
          total={result.filtered.length}
          tone="warning"
        >
          {result.safetyOverride.length === 0 ? (
            <Empty hint="本场景下没有订单触发安全层" />
          ) : (
            <ClassifiedList items={result.safetyOverride} />
          )}
        </ResultSection>

        <ResultSection
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          title="业务层自动同意"
          count={result.businessAutoApprove.length}
          total={result.filtered.length}
          tone="success"
        >
          {result.businessAutoApprove.length === 0 ? (
            <Empty hint="本场景下没有订单匹配自动同意条件" />
          ) : (
            <ClassifiedList items={result.businessAutoApprove} />
          )}
        </ResultSection>

        <ResultSection
          icon={<Users className="h-3.5 w-3.5" />}
          title="走人工复核"
          count={result.manualReview.length}
          total={result.filtered.length}
          tone="info"
        >
          {result.manualReview.length === 0 ? (
            <Empty hint="所有命中订单都被自动决策处理" />
          ) : (
            <ClassifiedList items={result.manualReview} />
          )}
        </ResultSection>

        <ResultSection
          icon={<ClipboardList className="h-3.5 w-3.5" />}
          title="派发的动作"
          count={result.actions.length}
          total={6}
          tone="info"
        >
          {result.actions.length === 0 ? (
            <Empty hint="未配置任何启用的动作" />
          ) : (
            <ul className="space-y-1.5">
              {result.actions.map((a) => (
                <li
                  key={a.kind}
                  className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-[12px]"
                >
                  <span className="font-medium text-text">{a.kind}</span>
                  <span className="flex items-center gap-2">
                    {a.detail && (
                      <span className="text-[11px] text-muted">
                        {a.detail}
                      </span>
                    )}
                    <Badge tone="primary">{a.count} 单</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ResultSection>

        {result.callSkill && (
          <ResultSection
            icon={<Network className="h-3.5 w-3.5" />}
            title="多智能体协同（MACP）"
            tone="success"
          >
            <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-[12px] leading-relaxed">
              <div className="font-semibold text-text">
                → 调用 {result.callSkill.name}
              </div>
              <div className="mt-1 text-[11px] text-muted">
                {result.callSkill.reason}
              </div>
            </div>
          </ResultSection>
        )}
      </div>
    </>
  );
}

// ── 子组件 ──────────────────────────────────────────

interface ResultSectionProps {
  icon: React.ReactNode;
  title: string;
  count?: number;
  total?: number;
  tone: 'info' | 'warning' | 'success' | 'danger';
  children: React.ReactNode;
}

function ResultSection({
  icon,
  title,
  count,
  total,
  tone,
  children,
}: ResultSectionProps) {
  const toneClass: Record<typeof tone, string> = {
    info: 'text-text',
    warning: 'text-warning',
    success: 'text-success',
    danger: 'text-danger',
  };
  return (
    <section className="mt-4 first-of-type:mt-3">
      <header className="flex items-center gap-2 border-b border-border pb-1.5">
        <span className={toneClass[tone]}>{icon}</span>
        <h3 className="text-[12px] font-semibold text-text">{title}</h3>
        {count !== undefined && (
          <span className="text-[11px] text-muted">
            {count}
            {total !== undefined && ` / ${total}`}
          </span>
        )}
      </header>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-bg/30 px-3 py-2 text-[11px] text-muted">
      <XCircle className="h-3 w-3" />
      {hint}
    </div>
  );
}

function OrderList({ orders }: { orders: PurchaseOrder[] }) {
  return (
    <ul className="space-y-1">
      {orders.map((o) => (
        <li
          key={o.id}
          className="rounded-md border border-border bg-surface px-3 py-2 text-[11px]"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-text">{o.id}</span>
            <span className="text-muted">
              {o.materialCode} · ¥{o.amount.toLocaleString()}
            </span>
          </div>
          <div className="mt-0.5 truncate text-muted">
            {o.materialName} · {o.supplierName}（{o.supplierTier} 级）
          </div>
        </li>
      ))}
    </ul>
  );
}

function ClassifiedList({
  items,
}: {
  items: Array<{ order: PurchaseOrder; reasons: string[] }>;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map(({ order, reasons }) => (
        <li
          key={order.id}
          className="rounded-md border border-border bg-surface px-3 py-2"
        >
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-mono text-text">{order.id}</span>
            <span className="text-[11px] text-muted">
              {order.supplierName} · ¥{order.amount.toLocaleString()}
            </span>
          </div>
          <ul className="mt-1 space-y-0.5">
            {reasons.map((r, i) => (
              <li key={i} className="text-[11px] text-muted">
                · {r}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
