import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';

import {
  metricSignal,
  selectMetrics,
  useScenarioStore,
  type Metric,
  type MetricsSnapshot,
} from '@/stores/scenario-store';
import { cn } from '@/lib/utils';

interface CardConfig {
  key: keyof MetricsSnapshot;
  title: string;
  description: string;
}

const CARDS: CardConfig[] = [
  {
    key: 'hitRate',
    title: '命中率',
    description: '默认配置覆盖率（反映筛选规则召回粒度）',
  },
  {
    key: 'safetyRate',
    title: '安全层覆盖率',
    description: '过低 = 规则太松；过高 = 数据集异常',
  },
  {
    key: 'autoApproveRate',
    title: '业务层自动率',
    description: '业务规则自动化覆盖深度',
  },
  {
    key: 'manualReviewRate',
    title: '人工介入率',
    description: '> 50% 说明规则太保守',
  },
  {
    key: 'callSkillSuccess',
    title: '子 Skill 调用成功率',
    description: '多智能体协同 SLA',
  },
  {
    key: 'avgToken',
    title: '平均 Token / 决策',
    description: '单决策算力成本',
  },
  {
    key: 'avgLatency',
    title: '平均延迟',
    description: '用户感知响应速度',
  },
  {
    key: 'totalCost',
    title: '累计成本',
    description: '单次扫描成本（vs 人工跟催）',
  },
];

export function EvalDashboard() {
  // ⚠️ 不用 zustand selector + useShallow —— selectMetrics 返回嵌套对象（8 个 Metric struct），
  // useShallow 的浅比较对嵌套字段失效 → 死循环（CLAUDE.md §5.5 教训的延伸）
  // 改用组件层 useMemo：traces ref 稳定时 metrics 不重算
  const traces = useScenarioStore((s) => s.traces);
  const metrics = useMemo(
    () => selectMetrics({ traces } as never),
    [traces],
  );
  const tracesEmpty = traces.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-border bg-surface px-4 py-3">
        <BarChart3 className="h-3.5 w-3.5 text-muted" />
        <h3 className="text-[13px] font-semibold">指标看板</h3>
        <span className="text-[10px] text-muted">PD-6 · actual + target</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {tracesEmpty && (
          <div className="rounded-md border border-dashed border-border bg-bg/40 px-3 py-4 text-center text-[11px] text-muted">
            指标待剧本运行后实时计算 · target 始终显示（PD-6 示意）
          </div>
        )}
        {CARDS.map((c) => (
          <MetricCard
            key={c.key}
            title={c.title}
            description={c.description}
            metric={metrics[c.key]}
          />
        ))}
        <div className="mt-3 rounded-md border border-border bg-bg/40 px-3 py-2 text-[9px] leading-relaxed text-muted">
          ⓘ actual 来自本次剧本 trace 计数 · target 是 ISV 调研 + 平台 SLA 假设的示意基准（PD-6）。
          生产版本需做 50+ ISV baseline 实测后再升级 target。
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  description: string;
  metric: Metric;
}

function MetricCard({ title, description, metric }: MetricCardProps) {
  const signal = metricSignal(metric);
  const targetText = formatTarget(metric);
  const actualText = formatActual(metric);
  const actualPct = computePercent(metric.actual, metric);
  const targetPct = computeTargetPercent(metric);

  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-medium text-text">{title}</div>
        <SignalDot signal={signal} />
      </div>

      <div className="mt-1.5 space-y-1">
        <Row label="Actual" value={actualText} pct={actualPct} tone="accent" />
        <Row label="Target" value={targetText} pct={targetPct} tone="muted" />
      </div>

      <div className="mt-1.5 text-[9px] text-muted">{description}</div>
    </div>
  );
}

function Row({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: string;
  pct: number;
  tone: 'accent' | 'muted';
}) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-12 text-muted">{label}</span>
      <span className="w-12 font-mono font-medium text-text tabular-nums">
        {value}
      </span>
      <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
        <div
          className={cn(
            'h-full',
            tone === 'accent' ? 'bg-accent' : 'bg-muted/60',
          )}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

function SignalDot({ signal }: { signal: 'green' | 'yellow' | 'red' }) {
  const color =
    signal === 'green'
      ? 'bg-success'
      : signal === 'yellow'
      ? 'bg-warning'
      : 'bg-danger';
  return (
    <span
      className={cn('h-2 w-2 rounded-full', color)}
      title={`信号：${signal}`}
    />
  );
}

function formatActual(m: Metric): string {
  if (m.unit === '%') return `${(m.actual * 100).toFixed(0)}%`;
  if (m.unit === 'ms') return `${m.actual}ms`;
  if (m.unit === '¥') return `¥${m.actual.toFixed(2)}`;
  return m.actual.toLocaleString();
}

function formatTarget(m: Metric): string {
  if (m.direction === 'rangeTarget') {
    const [low, high] = m.target as [number, number];
    if (m.unit === '%') return `${(low * 100).toFixed(0)}-${(high * 100).toFixed(0)}%`;
    return `${low}-${high}${m.unit ?? ''}`;
  }
  const t = m.target as number;
  const prefix = m.direction === 'higherBetter' ? '≥' : '≤';
  if (m.unit === '%') return `${prefix} ${(t * 100).toFixed(0)}%`;
  if (m.unit === 'ms') return `${prefix} ${t}ms`;
  if (m.unit === '¥') return `${prefix} ¥${t}`;
  return `${prefix} ${t.toLocaleString()}`;
}

/** actual 在进度条上的百分比位置 */
function computePercent(actual: number, m: Metric): number {
  if (m.unit === '%') return actual * 100;
  if (m.direction === 'rangeTarget') {
    const [, high] = m.target as [number, number];
    return (actual / high) * 100;
  }
  const t = m.target as number;
  if (m.direction === 'higherBetter') {
    // 目标 → 80% 进度；超过目标继续涨到 100
    return Math.min(100, (actual / t) * 80);
  }
  // lowerBetter：actual < target 时拉到 60%；超过 target 越多越接近 100
  if (actual <= t) return 60;
  return Math.min(100, 60 + ((actual - t) / t) * 40);
}

function computeTargetPercent(m: Metric): number {
  if (m.direction === 'rangeTarget') {
    const [, high] = m.target as [number, number];
    return m.unit === '%' ? high * 100 : 100;
  }
  if (m.direction === 'higherBetter') {
    return 80; // target 在 80% 处
  }
  return 60; // lowerBetter target 在 60% 处
}
