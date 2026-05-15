import { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Filter as FilterIcon,
  GitBranch,
  Send,
  Settings2,
  Target,
  UserCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  filterTraces,
  resolveOrderIds,
  selectTracesByStep,
  useScenarioStore,
} from '@/stores/scenario-store';
import { cn } from '@/lib/utils';
import type { TraceLog } from '@/types/agent';

const ALL_TYPES: TraceLog['type'][] = [
  'intent',
  'filter',
  'risk',
  'call-skill',
  'human-decision',
  'config-change',
];

const TYPE_LABEL: Record<TraceLog['type'], string> = {
  intent: '意图',
  filter: '筛选',
  risk: '风险',
  'call-skill': '子 Skill',
  'human-decision': '人工决策',
  'config-change': '配置变更',
};

const TYPE_TONE: Record<
  TraceLog['type'],
  'default' | 'primary' | 'accent' | 'success' | 'warning' | 'danger'
> = {
  intent: 'primary',
  filter: 'accent',
  risk: 'warning',
  'call-skill': 'success',
  'human-decision': 'danger',
  'config-change': 'default',
};

const TYPE_ICON: Record<TraceLog['type'], typeof Activity> = {
  intent: Target,
  filter: FilterIcon,
  risk: AlertCircle,
  'call-skill': GitBranch,
  'human-decision': UserCheck,
  'config-change': Settings2,
};

const STEP_LABEL: Record<number, string> = {
  1: 'Step 1 · 触发',
  2: 'Step 2 · 扫描',
  3: 'Step 3 · 安全层 + 多智能体',
  4: 'Step 4 · 用户追问',
  5: 'Step 5 · 配置调整 + 重跑',
  6: 'Step 6 · 收尾',
};

export function TraceList() {
  const traces = useScenarioStore((s) => s.traces);
  const selectedTraceId = useScenarioStore((s) => s.selectedTraceId);
  const setSelectedTrace = useScenarioStore((s) => s.setSelectedTrace);

  const [enabledTypes, setEnabledTypes] = useState<Set<TraceLog['type']>>(
    new Set(ALL_TYPES),
  );
  const [orderFilter, setOrderFilter] = useState<string>('__all__');

  const orderOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of traces) {
      for (const id of resolveOrderIds(t)) set.add(id);
    }
    return Array.from(set).sort();
  }, [traces]);

  const filteredTraces = useMemo(() => {
    return filterTraces(
      traces,
      Array.from(enabledTypes),
      orderFilter === '__all__' ? null : orderFilter,
    );
  }, [traces, enabledTypes, orderFilter]);

  const stepGroups = useMemo(() => {
    return selectTracesByStep({ traces: filteredTraces } as never);
  }, [filteredTraces]);

  const totalCounts = useMemo(() => {
    return selectTracesByStep({ traces } as never);
  }, [traces]);

  if (traces.length === 0) {
    return <TraceListEmpty />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部 filter */}
      <div className="space-y-2 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold">
          <Activity className="h-3.5 w-3.5 text-muted" />
          Trace 时间线
          <span className="text-[10px] font-normal text-muted">
            · {traces.length} 条
            {filteredTraces.length !== traces.length &&
              ` · 已过滤显示 ${filteredTraces.length}`}
          </span>
        </div>

        <TypeFilter enabled={enabledTypes} onChange={setEnabledTypes} />

        <OrderFilter
          value={orderFilter}
          onChange={setOrderFilter}
          options={orderOptions}
        />
      </div>

      {/* 6 段分组 */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {[1, 2, 3, 4, 5, 6].map((step) => {
          const items = stepGroups.get(step) ?? [];
          const totalInStep = totalCounts.get(step)?.length ?? 0;
          const hidden = totalInStep - items.length;
          return (
            <TraceListGroup
              key={step}
              step={step}
              items={items}
              hiddenCount={hidden}
              selectedTraceId={selectedTraceId}
              onSelect={setSelectedTrace}
            />
          );
        })}
      </div>
    </div>
  );
}

function TypeFilter({
  enabled,
  onChange,
}: {
  enabled: Set<TraceLog['type']>;
  onChange: (next: Set<TraceLog['type']>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
      <span className="text-muted">类型</span>
      {ALL_TYPES.map((t) => {
        const isOn = enabled.has(t);
        return (
          <label
            key={t}
            className="inline-flex cursor-pointer items-center gap-1"
          >
            <Checkbox
              checked={isOn}
              onCheckedChange={(v) => {
                const next = new Set(enabled);
                if (v) next.add(t);
                else next.delete(t);
                onChange(next);
              }}
            />
            <span className="text-text">{TYPE_LABEL[t]}</span>
          </label>
        );
      })}
    </div>
  );
}

function OrderFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-muted">订单</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] text-text"
      >
        <option value="__all__">全部</option>
        {options.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </div>
  );
}

interface TraceListGroupProps {
  step: number;
  items: TraceLog[];
  hiddenCount: number;
  selectedTraceId: string | null;
  onSelect: (id: string) => void;
}

function TraceListGroup({
  step,
  items,
  hiddenCount,
  selectedTraceId,
  onSelect,
}: TraceListGroupProps) {
  return (
    <details className="mb-1.5" open={items.length > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-2 py-1 text-[11px] font-medium text-text hover:bg-bg [&::-webkit-details-marker]:hidden">
        <span>{STEP_LABEL[step] ?? `Step ${step}`}</span>
        <span className="text-[10px] text-muted">
          {items.length}
          {hiddenCount > 0 && ` (已隐藏 ${hiddenCount})`}
        </span>
      </summary>
      <div className="mt-1 space-y-1">
        {items.length === 0 ? (
          <div className="px-3 py-1.5 text-[10px] text-muted">
            该步无 trace
          </div>
        ) : (
          items.map((t) => (
            <TraceListItem
              key={t.id}
              trace={t}
              isSelected={selectedTraceId === t.id}
              onClick={() => onSelect(t.id)}
            />
          ))
        )}
      </div>
    </details>
  );
}

interface TraceListItemProps {
  trace: TraceLog;
  isSelected: boolean;
  onClick: () => void;
}

function TraceListItem({ trace, isSelected, onClick }: TraceListItemProps) {
  const Icon = TYPE_ICON[trace.type];
  const orderIds = resolveOrderIds(trace);
  const summary = summarizeTrace(trace);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-md border bg-surface px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-bg',
        isSelected
          ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
          : 'border-border',
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted" />
        <span className="font-mono text-[10px] text-muted">{trace.id}</span>
        <Badge tone={TYPE_TONE[trace.type]}>{TYPE_LABEL[trace.type]}</Badge>
        <span className="ml-auto font-mono text-[10px] text-muted">
          +{trace.timestamp}ms
        </span>
      </div>
      <div className="mt-1 line-clamp-2 text-[11px] text-text">
        {summary}
      </div>
      {orderIds.length > 0 && (
        <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-muted">
          <Send className="h-2.5 w-2.5" />
          {orderIds.length === 1
            ? orderIds[0]
            : `${orderIds[0]} 等 ${orderIds.length} 条`}
        </div>
      )}
    </button>
  );
}

function summarizeTrace(trace: TraceLog): string {
  switch (trace.type) {
    case 'intent':
      return `${trace.input.triggerSource} 触发 → ${trace.output.intent}（置信度 ${(trace.output.confidence * 100).toFixed(0)}%）`;
    case 'filter':
      return trace.output.hit
        ? `${trace.input.orderId} 命中`
        : `${trace.input.orderId} 未命中：${trace.output.failedRules?.join('；') ?? '—'}`;
    case 'risk': {
      const tags: string[] = [`风险=${trace.output.riskLevel}`];
      if (trace.output.safetyBlocked) tags.push('安全层覆盖');
      if (trace.output.autoApproved) tags.push('业务自动同意');
      return `${trace.input.orderId} · ${tags.join(' · ')}`;
    }
    case 'call-skill': {
      const o = trace.output;
      if (o.status === 'ok')
        return `${trace.input.callerSkillId} → 齐套预警 · ok · 缺料 ${o.shortageCount} 项`;
      return `${trace.input.callerSkillId} → 齐套预警 · ${o.status}（fallback: ${o.fallback}）`;
    }
    case 'human-decision':
      return `${trace.input.orderId} → ${humanDecisionLabel(trace.output.decision)}（${trace.output.clickedBy === 'mockCursor' ? '伪光标' : '用户'}）`;
    case 'config-change':
      return `${trace.input.path} · ${trace.output.scope} · 影响 ${trace.output.affectedOrderIds.length} 条订单`;
  }
}

function humanDecisionLabel(d: string): string {
  switch (d) {
    case 'dispatchToManager':
      return '派发主管';
    case 'reassignManual':
      return '改派人工';
    case 'skip':
      return '跳过';
    default:
      return d;
  }
}

function TraceListEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
      <Activity className="h-8 w-8 text-muted opacity-40" />
      <div className="text-[13px] font-medium text-text">暂无 Trace 数据</div>
      <div className="text-[11px] text-muted">
        请先到 Agent Console 启动剧本
      </div>
      <div className="text-[10px] text-muted">
        剧本运行后 trace 会在此处汇集
      </div>
      <a
        href="/agent-console"
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
      >
        跳转到 Agent Console
        <ArrowRight className="h-3 w-3" />
      </a>
    </div>
  );
}

