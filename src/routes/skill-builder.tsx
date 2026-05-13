import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';

import { ThreeColumnLayout } from '@/components/layout/three-column-layout';
import { CodeView } from '@/components/skill-builder/code-view';
import { ActionsModule } from '@/components/skill-builder/modules/actions-module';
import { AutomationModule } from '@/components/skill-builder/modules/automation-module';
import { FiltersModule } from '@/components/skill-builder/modules/filters-module';
import { KnowledgeModule } from '@/components/skill-builder/modules/knowledge-module';
import { ModelRoutingModule } from '@/components/skill-builder/modules/model-routing-module';
import { TriggersModule } from '@/components/skill-builder/modules/triggers-module';
import { ConflictBanner } from '@/components/skill-builder/shared/conflict-banner';
import { SimulationCard } from '@/components/skill-builder/simulation-drawer';
import { Badge } from '@/components/ui/badge';
import { useConflicts } from '@/hooks/use-conflicts';
import { cn } from '@/lib/utils';
import { useSkillStore } from '@/stores/skill-store';
import type { SkillConfig } from '@/types/skill';

export const Route = createFileRoute('/skill-builder')({
  component: SkillBuilderPage,
});

type ModuleKey =
  | 'metadata'
  | 'triggers'
  | 'filters'
  | 'actions'
  | 'automation'
  | 'modelRouting'
  | 'knowledge';

interface NavItem {
  key: ModuleKey;
  label: string;
  phase: 'P0' | 'P1' | 'P2';
  isCore?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'metadata', label: '元信息', phase: 'P2' },
  { key: 'triggers', label: '触发方式', phase: 'P0' },
  { key: 'filters', label: '筛选规则', phase: 'P0', isCore: true },
  { key: 'actions', label: '动作配置', phase: 'P1' },
  { key: 'automation', label: '自动化边界', phase: 'P0', isCore: true },
  { key: 'modelRouting', label: '模型路由', phase: 'P1' },
  { key: 'knowledge', label: '知识检索', phase: 'P1' },
];

const MODULE_META: Record<ModuleKey, { title: string; subtitle: string }> = {
  metadata: { title: '元信息', subtitle: '模块一 · P2' },
  triggers: { title: '触发方式', subtitle: '模块二 · P0' },
  filters: { title: '筛选规则', subtitle: '模块三 · P0 · 核心' },
  actions: { title: '动作配置', subtitle: '模块四 · P1' },
  automation: { title: '自动化边界', subtitle: '模块五 · P0 · 核心' },
  modelRouting: { title: '模型路由', subtitle: '模块六 · P1' },
  knowledge: { title: '知识检索', subtitle: '模块七 · P1' },
};

function SkillBuilderPage() {
  const [selected, setSelected] = useState<ModuleKey>('filters');
  const config = useSkillStore((s) => s.config);
  const viewMode = useSkillStore((s) => s.viewMode);
  const setViewMode = useSkillStore((s) => s.setViewMode);

  // PD-5：用 useMemo 而非手动触发；统一封装在 useConflicts 里
  const conflicts = useConflicts();

  const meta = MODULE_META[selected];

  // 冲突栏点击 → 模块跳转。source 是 SkillConfig key，
  // 此处只需把已经实现的几个映射回来；其他暂时不跳。
  const handleJump = (source: keyof SkillConfig) => {
    const map: Partial<Record<keyof SkillConfig, ModuleKey>> = {
      triggers: 'triggers',
      filters: 'filters',
      actions: 'actions',
      automationBoundary: 'automation',
      modelRouting: 'modelRouting',
      knowledgeRetrieval: 'knowledge',
    };
    const target = map[source];
    if (target) setSelected(target);
  };

  return (
    <ThreeColumnLayout
      left={
        <div className="flex h-full flex-col">
          <div className="border-b border-border px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-muted">
              当前 Skill
            </div>
            <div className="mt-1 text-[13px] font-semibold">
              {config.metadata.name}
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              {config.metadata.version} · 草稿
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            {NAV_ITEMS.map((item) => {
              const active = selected === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelected(item.key)}
                  className={cn(
                    'group mb-0.5 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[13px] transition-colors',
                    active
                      ? 'bg-primary/8 text-primary'
                      : 'text-text hover:bg-bg',
                  )}
                  style={
                    active
                      ? { backgroundColor: 'rgba(59, 92, 126, 0.08)' }
                      : undefined
                  }
                >
                  <span className="flex items-center gap-1.5">
                    {item.label}
                    {item.isCore && <Badge tone="accent">核心</Badge>}
                  </span>
                  <span className="text-[10px] text-muted">{item.phase}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-border p-3">
            <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">
              视图模式
            </div>
            <div className="inline-flex w-full overflow-hidden rounded-md border border-border bg-surface text-[12px]">
              <button
                type="button"
                onClick={() => setViewMode('lowCode')}
                className={cn(
                  'flex-1 py-1.5',
                  viewMode === 'lowCode'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted hover:text-text',
                )}
              >
                Low Code
              </button>
              <button
                type="button"
                onClick={() => setViewMode('codeView')}
                className={cn(
                  'flex-1 py-1.5',
                  viewMode === 'codeView'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted hover:text-text',
                )}
              >
                Code View
              </button>
            </div>
          </div>
        </div>
      }
      center={
        viewMode === 'codeView' ? (
          <div className="flex h-full flex-col">
            <CodeView />
            <ConflictBanner conflicts={conflicts} onJump={handleJump} />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <header className="flex items-baseline gap-3 border-b border-border bg-surface px-6 py-3">
              <h2 className="text-[15px] font-semibold">{meta.title}</h2>
              <span className="text-[12px] text-muted">{meta.subtitle}</span>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              {selected === 'triggers' && <TriggersModule />}
              {selected === 'filters' && <FiltersModule />}
              {selected === 'actions' && <ActionsModule />}
              {selected === 'automation' && <AutomationModule />}
              {selected === 'modelRouting' && <ModelRoutingModule />}
              {selected === 'knowledge' && <KnowledgeModule />}
              {selected === 'metadata' && (
                <ModulePlaceholder moduleKey={selected} />
              )}
            </div>

            <ConflictBanner conflicts={conflicts} onJump={handleJump} />
          </div>
        )
      }
      right={<RightPreview />}
    />
  );
}

function ModulePlaceholder({ moduleKey }: { moduleKey: ModuleKey }) {
  const hints: Record<ModuleKey, string> = {
    metadata: '元信息字段：Skill 名称 / 适用行业 / 适用 ISV 角色 / 模板来源等。',
    triggers: '',
    filters:
      '时间 / 供应商 / 物料属性（三态选择）/ 影响范围；含隐式联动可视化。',
    actions:
      '通知 / 标记 / 升级 / 派发 / 调用其他 Skill（多智能体协同入口）。',
    automation: '三层固定优先级：安全（锁定）> 业务（可配）> 效率（默认开）。',
    modelRouting: '6 个任务类型 × 8 个模型；4 选 1 路由模式。',
    knowledge:
      '知识源 / 检索时机 / 粒度 / Top-K / 阈值 / 失败兜底（显式配置）。',
  };

  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
      <div className="text-[13px] font-medium text-text">下一段实现</div>
      <div className="mt-1 text-[12px] text-muted">{hints[moduleKey]}</div>
    </div>
  );
}

function RightPreview() {
  const config = useSkillStore((s) => s.config);
  const enabledTriggerCount = [
    config.triggers.event.enabled,
    config.triggers.schedule.enabled,
    config.triggers.naturalLanguage.enabled,
    config.triggers.manual.enabled,
  ].filter(Boolean).length;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <PreviewCard title="Skill 卡片">
        <div className="space-y-1.5 text-[12px]">
          <div className="font-medium text-text">
            {config.metadata.name} {config.metadata.version}
          </div>
          <div className="text-muted">
            适用：{config.metadata.industry.join('、')}
          </div>
          <div className="text-muted">
            角色：
            {config.metadata.isvRoles
              .map((r) => (r === 'businessConsultant' ? '业务顾问' : '开发者'))
              .join('、')}
          </div>
        </div>
      </PreviewCard>

      <PreviewCard title="模拟运行">
        <SimulationCard />
      </PreviewCard>

      <PreviewCard title="触发摘要">
        <div className="space-y-1.5 text-[12px]">
          <TriggerLine
            label="事件触发"
            enabled={config.triggers.event.enabled}
            extra={
              config.triggers.event.enabled
                ? `${config.triggers.event.sources.length} 个源`
                : undefined
            }
          />
          <TriggerLine
            label="定时触发"
            enabled={config.triggers.schedule.enabled}
            extra={
              config.triggers.schedule.enabled
                ? config.triggers.schedule.cron
                : undefined
            }
          />
          <TriggerLine
            label="自然语言"
            enabled={config.triggers.naturalLanguage.enabled}
          />
          <TriggerLine label="手动" enabled={config.triggers.manual.enabled} />
        </div>
      </PreviewCard>

      <PreviewCard title="筛选摘要">
        <div className="space-y-1 text-[12px]">
          <SummaryLine
            label="模式"
            value={
              config.filters.mode === 'active' ? '主动跟催' : '被动响应'
            }
          />
          <SummaryLine
            label="到货前"
            value={`${config.filters.time.dueInDays} 天`}
          />
          <SummaryLine
            label="供应商等级"
            value={
              config.filters.supplier.tier.length === 0
                ? '不限'
                : config.filters.supplier.tier.join(' / ')
            }
          />
          <SummaryLine
            label="关键件"
            value={tristateLabel(config.filters.material.isCritical)}
            highlight={config.filters.material.isCritical === 'yes'}
          />
          <SummaryLine
            label="单一来源"
            value={tristateLabel(config.filters.material.isSingleSource)}
            highlight={config.filters.material.isSingleSource === 'yes'}
          />
        </div>
      </PreviewCard>

      <PreviewCard title="动作摘要">
        <ActionsSummary />
      </PreviewCard>

      <PreviewCard title="模型路由摘要">
        <ModelRoutingSummary />
      </PreviewCard>

      <PreviewCard title="知识检索摘要">
        <KnowledgeSummary />
      </PreviewCard>

      <PreviewCard title="自动化边界摘要">
        <div className="space-y-1 text-[12px]">
          <SummaryLine label="安全层" value="4 条硬规则锁定" />
          <SummaryLine
            label="自动同意 ≤"
            value={
              config.automationBoundary.business.autoApproveIfDelayLE.enabled
                ? `${config.automationBoundary.business.autoApproveIfDelayLE.days} 天`
                : '关闭'
            }
          />
          <SummaryLine
            label="A 级自动同意"
            value={
              config.automationBoundary.business.autoApproveTierA ? '开' : '关'
            }
          />
          <SummaryLine
            label="KA 必须人工"
            value={
              !config.filters.impact.affectsCustomerOrder
                ? '不适用'
                : config.automationBoundary.business.mustHumanIfCustomerKA
                  ? '开'
                  : '关'
            }
          />
          <SummaryLine
            label="跟催上限"
            value={`${config.automationBoundary.efficiency.maxFollowUpCount} 次`}
          />
          <SummaryLine
            label="金额上限"
            value={`¥${config.automationBoundary.efficiency.autoApproveAmountLimit.toLocaleString()}`}
          />
        </div>
      </PreviewCard>

      <PreviewCard title="复用统计">
        <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
          <Stat label="客户数" value="3" />
          <Stat label="月调用" value="1.2k" />
          <Stat
            label="启用触发"
            value={`${enabledTriggerCount}/4`}
          />
        </div>
        <div className="mt-2 text-[10px] text-muted">
          客户数 / 月调用为示意数据
        </div>
      </PreviewCard>
    </div>
  );
}

interface TriggerLineProps {
  label: string;
  enabled: boolean;
  extra?: string;
}

function TriggerLine({ label, enabled, extra }: TriggerLineProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span
        className={cn(
          'flex items-center gap-1.5',
          enabled ? 'text-text' : 'text-muted',
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            enabled ? 'bg-success' : 'bg-border',
          )}
        />
        {enabled ? extra ?? '启用' : '关闭'}
      </span>
    </div>
  );
}

interface PreviewCardProps {
  title: string;
  children: React.ReactNode;
}

function PreviewCard({ title, children }: PreviewCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">
        {title}
      </div>
      {children}
    </div>
  );
}

interface SummaryLineProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function SummaryLine({ label, value, highlight = false }: SummaryLineProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span
        className={cn(
          highlight ? 'font-semibold text-warning' : 'text-text',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ActionsSummary() {
  const actions = useSkillStore((s) => s.config.actions);
  const items: Array<{ key: string; label: string; enabled: boolean }> = [
    { key: 'sendSupplierReminder', label: '发送跟催', enabled: actions.sendSupplierReminder.enabled },
    { key: 'markUrgent', label: '标记加急', enabled: actions.markUrgent.enabled },
    { key: 'secondaryFollowUp', label: '二次跟催', enabled: actions.secondaryFollowUp.enabled },
    { key: 'createExceptionTask', label: '创建异常任务', enabled: actions.createExceptionTask.enabled },
    { key: 'dispatchTaskCard', label: '派发任务卡', enabled: actions.dispatchTaskCard.enabled },
    { key: 'callSkill', label: '调用其他 Skill', enabled: actions.callSkill.enabled },
  ];
  const enabledCount = items.filter((i) => i.enabled).length;
  const callSkillTargetLabel = (() => {
    if (!actions.callSkill.enabled) return null;
    const map: Record<string, string> = {
      completenessAlert: '齐套预警',
      supplierRiskAssessment: '供应商风险评估',
      exceptionWorkOrderEscalation: '异常工单升级',
    };
    return actions.callSkill.targetSkill
      ? map[actions.callSkill.targetSkill] ?? actions.callSkill.targetSkill
      : '未选择目标';
  })();

  return (
    <div className="space-y-1.5 text-[12px]">
      <div className="flex items-center justify-between">
        <span className="text-muted">启用</span>
        <span className="font-semibold text-text">{enabledCount} / 6</span>
      </div>
      <div className="border-t border-border pt-1.5">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between py-0.5">
            <span
              className={cn(
                'flex items-center gap-1.5',
                item.enabled ? 'text-text' : 'text-muted',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  item.enabled ? 'bg-success' : 'bg-border',
                )}
              />
              {item.label}
            </span>
            {item.key === 'callSkill' && callSkillTargetLabel && (
              <span className="text-[11px] text-accent">
                → {callSkillTargetLabel}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelRoutingSummary() {
  const routing = useSkillStore((s) => s.config.modelRouting);
  const modeLabel: Record<string, string> = {
    static: '静态配置',
    dynamic: '动态路由',
    costFirst: '成本优先',
    performanceFirst: '性能优先',
  };
  const modelLabel: Record<string, string> = {
    'deepseek-v3': 'DeepSeek-V3',
    'deepseek-r1': 'DeepSeek-R1',
    'gpt-4': 'GPT-4',
    'claude-sonnet': 'Claude Sonnet',
    'qwen-plus': 'Qwen-Plus',
    'qwen-max': 'Qwen-Max',
    'wenxin-4': '文心一言 4',
    'private-qwen': '私有化-Qwen',
  };
  return (
    <div className="space-y-1 text-[12px]">
      <SummaryLine label="路由模式" value={modeLabel[routing.mode] ?? routing.mode} />
      <SummaryLine label="意图识别" value={modelLabel[routing.routes.intentDetection] ?? routing.routes.intentDetection} />
      <SummaryLine label="风险判断" value={modelLabel[routing.routes.riskAssessment] ?? routing.routes.riskAssessment} />
      <SummaryLine label="话术生成" value={modelLabel[routing.routes.narrativeGeneration] ?? routing.routes.narrativeGeneration} />
      <SummaryLine label="敏感场景" value={modelLabel[routing.routes.sensitive] ?? routing.routes.sensitive} highlight={routing.routes.sensitive !== 'private-qwen'} />
    </div>
  );
}

function KnowledgeSummary() {
  const knowledge = useSkillStore((s) => s.config.knowledgeRetrieval);
  const granLabel: Record<string, string> = {
    supplier: '供应商级',
    material: '物料级',
    order: '订单级',
  };
  const fallbackLabel: Record<string, string> = {
    useDefaultNarrative: '使用默认话术',
    escalateToHuman: '转人工',
    skipStep: '跳过该步骤',
  };
  return (
    <div className="space-y-1 text-[12px]">
      <SummaryLine
        label="知识源"
        value={`${knowledge.sources.length} 个`}
      />
      <SummaryLine
        label="检索时机"
        value={`${knowledge.triggerOn.length} 处`}
      />
      <SummaryLine
        label="粒度"
        value={granLabel[knowledge.granularity] ?? knowledge.granularity}
      />
      <SummaryLine
        label="Top-K / 阈值"
        value={`${knowledge.topK} / ${knowledge.similarityThreshold.toFixed(2)}`}
      />
      <SummaryLine
        label="失败兜底"
        value={fallbackLabel[knowledge.fallbackStrategy] ?? knowledge.fallbackStrategy}
      />
    </div>
  );
}

function tristateLabel(v: 'yes' | 'no' | 'any'): string {
  if (v === 'yes') return '是';
  if (v === 'no') return '否';
  return '不限';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-bg px-2 py-1.5">
      <div className="text-[13px] font-semibold text-text">{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}
