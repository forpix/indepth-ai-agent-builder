import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Brain,
  ChevronRight,
  Coins,
  Cpu,
  ExternalLink,
  History,
  ListOrdered,
  Network,
  Settings2,
  Target,
} from 'lucide-react';

import { MultiAgentDiagram } from '@/components/agent-console/multi-agent-diagram';
import { MOCK_MEMORY_ENTRIES } from '@/mocks/cot-traces';
import { defaultSkillConfig } from '@/lib/skill-defaults';
import { useScenarioStore, selectHud } from '@/stores/scenario-store';
import { SCENARIO_STEP_INDEX, type ScenarioStep } from '@/types/agent';
import { cn } from '@/lib/utils';

const STEP_TO_INTENT: Record<ScenarioStep, string> = {
  idle: '等待触发...',
  trigger: '剧本启动 / 应用 scenarioConfigOverride',
  scanning: '全量扫描跟催场景 / 命中 6 条',
  'safety-block': '高风险订单识别 → 触发安全层硬规则',
  'user-question': '回应采购员追问规则优先级（P1）',
  'config-adjust': '原地浮起迷你 Skill Builder 调参（P1）',
  rerun: '应用配置变更 → 自动重跑（P1）',
  done: '复盘结束 — 等待跳转 Debug & Eval',
};

export function DecisionPanel() {
  const currentStep = useScenarioStore((s) => s.currentStep);
  const hud = useScenarioStore(useShallow(selectHud));
  const openD7Card = useScenarioStore((s) => s.openD7Card);
  const thisRunOverride = useScenarioStore((s) => s.thisRunConfigOverride);
  const stepIndex = SCENARIO_STEP_INDEX[currentStep];

  const intentText = STEP_TO_INTENT[currentStep];

  const showSkillRefs = stepIndex >= 2;
  const showCallSkill = stepIndex >= 3;
  const showPriorityViz = stepIndex >= 4;
  // D7 入口 guard（Codex review #1）：
  // 安全层评估（Step 3）必须先发生，再允许调参。否则会绕过 RiskTrace/CallSkillTrace
  // 把剧本推到 rerun → done，trace 不完整违反 PD-7。
  const canAdjustConfig = stepIndex >= 3;
  // 业务层"延期 ≤ N 天"当前生效值（thisRunOverride 优先）
  const effectiveDelayDays =
    thisRunOverride.autoApproveIfDelayDays ??
    defaultSkillConfig.automationBoundary.business.autoApproveIfDelayLE.days;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
        <Brain className="h-3.5 w-3.5 text-muted" />
        <h3 className="text-[13px] font-semibold">决策面板</h3>
        <span className="text-[11px] text-muted">透明度 · PD-7</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <Section icon={<Target className="h-3 w-3" />} title="当前意图" defaultOpen>
          <div className="text-[12px] text-text">{intentText}</div>
          {stepIndex > 0 && (
            <div className="mt-1.5 text-[10px] text-muted">
              第 {stepIndex} 步 / 6 · {currentStep}
            </div>
          )}
        </Section>

        <Section
          icon={<Settings2 className="h-3 w-3" />}
          title="引用 Skill 配置"
          defaultOpen
        >
          {!showSkillRefs && (
            <div className="text-[11px] text-muted">扫描后展示</div>
          )}
          {showSkillRefs && (
            <div className="space-y-2 text-[11px]">
              <RuleRef
                label="安全层 / 关键件 → 必须人工"
                hint="PD-3 硬规则，UI 锁死不可关"
              />
              <RuleRef
                label="安全层 / 影响在制工单 → 必须人工"
                hint="本剧本由 PO-001、PO-007 触发"
              />
              <RuleRef
                label={`业务层 / 延期 ≤ ${effectiveDelayDays} 天自动同意`}
                hint={
                  thisRunOverride.autoApproveIfDelayDays !== undefined
                    ? '已被 thisRunOnly 临时调整'
                    : canAdjustConfig
                    ? '当前阈值 2 天，可临时调整到 3 天'
                    : '需先完成安全层评估（Step 3）才能调参'
                }
                onAdjust={canAdjustConfig ? openD7Card : undefined}
              />
              <RuleRef
                label="效率层 / 自动同意金额上限 ¥10,000"
                hint="超额订单强制人工（兜底约束）"
              />
            </div>
          )}
        </Section>

        {showPriorityViz && (
          <Section
            icon={<ListOrdered className="h-3 w-3" />}
            title="规则优先级（PD-3）"
            defaultOpen
          >
            <PriorityViz effectiveDelayDays={effectiveDelayDays} />
          </Section>
        )}

        <Section
          icon={<History className="h-3 w-3" />}
          title={`Memory 摘要（过往 ${MOCK_MEMORY_ENTRIES.length} 条相关决策）`}
          defaultOpen
        >
          <ul className="space-y-2 text-[11px]">
            {MOCK_MEMORY_ENTRIES.map((m) => (
              <li key={m.order} className="text-text">
                <div className="text-muted">{m.date} · {m.order}</div>
                <div>{m.summary} → 决策：<span className="text-accent">{m.decision}</span></div>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={<Cpu className="h-3 w-3" />} title="模型路由">
          <ModelRouteList currentStep={currentStep} />
        </Section>

        <Section icon={<Coins className="h-3 w-3" />} title="Token / 成本">
          <div className="space-y-1 text-[11px]">
            <KV label="累计 Token" value={hud.totalTokens.toLocaleString()} />
            <KV label="累计成本（估算）" value={`¥${hud.cost.toFixed(2)}`} />
            <KV label="平均延迟" value={`${hud.avgLatencyMs} ms`} />
          </div>
        </Section>

        <Section
          icon={<Network className="h-3 w-3" />}
          title="多智能体协作"
          defaultOpen={showCallSkill}
        >
          {!showCallSkill && (
            <div className="text-[11px] text-muted">
              Step 3 触发时自动展开（D6 炫点）
            </div>
          )}
          {showCallSkill && <MultiAgentDiagram />}
        </Section>
      </div>
    </div>
  );
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ icon, title, defaultOpen = false, children }: SectionProps) {
  return (
    <details className="mb-3 rounded-md border border-border bg-surface" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[12px] font-medium [&::-webkit-details-marker]:hidden">
        <span className="text-muted">{icon}</span>
        <span>{title}</span>
        <ChevronRight className="ml-auto h-3 w-3 text-muted transition-transform [details[open]_&]:rotate-90" />
      </summary>
      <div className="border-t border-border px-3 py-2.5">{children}</div>
    </details>
  );
}

function RuleRef({
  label,
  hint,
  onAdjust,
}: {
  label: string;
  hint: string;
  onAdjust?: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-bg/40 px-2.5 py-2">
      <div className="font-medium text-text">{label}</div>
      <div className="mt-0.5 text-[10px] text-muted">{hint}</div>
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          title="跳回 Skill Builder Tab 高亮（占位，未实装跳转）"
          className="inline-flex items-center gap-0.5 text-[10px] text-accent hover:underline disabled:text-muted disabled:no-underline"
          disabled
        >
          <ExternalLink className="h-2.5 w-2.5" />
          查看
        </button>
        {onAdjust && (
          <button
            type="button"
            onClick={onAdjust}
            className="inline-flex items-center gap-0.5 text-[10px] text-accent hover:underline"
          >
            <Settings2 className="h-2.5 w-2.5" />
            临时调整
          </button>
        )}
      </div>
    </div>
  );
}

function PriorityViz({ effectiveDelayDays }: { effectiveDelayDays: number }) {
  return (
    <div className="space-y-2 text-[11px]">
      <div className="grid grid-cols-3 gap-2">
        <PriorityCol
          icon="🛡"
          name="安全层"
          rule="关键件"
          status="cover"
          subtitle="覆盖"
        />
        <PriorityCol
          icon="📋"
          name="业务层"
          rule={`延期 ≤ ${effectiveDelayDays} 天`}
          status="overridden"
          subtitle="被覆盖"
        />
        <PriorityCol icon="⚡" name="效率层" rule="—" status="idle" subtitle="—" />
      </div>
      <div className="rounded-md border border-border bg-bg/40 px-2.5 py-1.5 text-[10px] text-muted">
        PO-2025-005 的实例：安全层"关键件"硬规则触发，覆盖业务层"延期 ≤{' '}
        {effectiveDelayDays} 天自动同意"，最终走人工。
      </div>
    </div>
  );
}

function PriorityCol({
  icon,
  name,
  rule,
  status,
  subtitle,
}: {
  icon: string;
  name: string;
  rule: string;
  status: 'cover' | 'overridden' | 'idle';
  subtitle: string;
}) {
  const tone =
    status === 'cover'
      ? 'border-warning/40 bg-warning/10 text-text'
      : status === 'overridden'
      ? 'border-border bg-bg/40 text-muted'
      : 'border-border bg-bg/40 text-muted';
  return (
    <div className={cn('rounded-md border px-2 py-2', tone)}>
      <div className="text-[12px] font-medium">
        <span>{icon}</span> <span>{name}</span>
      </div>
      <div
        className={cn(
          'mt-1 text-[10px]',
          status === 'overridden' && 'line-through',
        )}
      >
        {rule}
      </div>
      <div
        className={cn(
          'mt-0.5 text-[9px] uppercase tracking-wide',
          status === 'cover' && 'text-warning',
          status === 'overridden' && 'text-danger',
        )}
      >
        {subtitle}
      </div>
    </div>
  );
}

function ModelRouteList({ currentStep }: { currentStep: ScenarioStep }) {
  const items: { task: string; model: string; active: boolean }[] = [
    {
      task: '意图分析',
      model: 'DeepSeek-V3',
      active: currentStep === 'trigger' || currentStep === 'scanning',
    },
    {
      task: '风险综合判断',
      model: 'GPT-4',
      active: currentStep === 'safety-block',
    },
    {
      task: '齐套调用 / 异常诊断',
      model: 'DeepSeek-R1',
      active: currentStep === 'safety-block',
    },
  ];
  return (
    <div className="space-y-1.5 text-[11px]">
      {items.map((it) => (
        <div
          key={it.task}
          className="flex items-center justify-between rounded-md border border-border bg-bg/30 px-2.5 py-1.5"
        >
          <span className="text-text">{it.task}</span>
          <span className={cn('flex items-center gap-1.5 font-mono text-[10px]')}>
            {it.active && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            )}
            <span className={it.active ? 'text-success' : 'text-muted'}>
              {it.model}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-mono tabular-nums text-text">{value}</span>
    </div>
  );
}

export function useDecisionStepIndex() {
  const currentStep = useScenarioStore((s) => s.currentStep);
  return useMemo(() => SCENARIO_STEP_INDEX[currentStep], [currentStep]);
}
