import { Gauge, Lock, Sliders } from 'lucide-react';

import { ConfigCard } from '@/components/skill-builder/shared/config-card';
import { ConfigRow } from '@/components/skill-builder/shared/config-row';
import { LockedToggle } from '@/components/skill-builder/shared/locked-toggle';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useOverriddenPaths } from '@/hooks/use-conflicts';
import { useSkillStore } from '@/stores/skill-store';

/**
 * 模块五：自动化边界 ⭐ —— spec §6 · PD-3 核心展示位。
 *
 * 三层固定优先级：**安全 > 业务 > 效率**。
 * - 安全层：4 个 LockedToggle，UI 锁死。这是用产品约束代替用户脑力。
 * - 业务层：可配置，但被安全层硬规则覆盖时冲突预警会实时显示。
 * - 效率层：默认开启的兜底约束（跟催次数上限、自动同意金额上限）。
 *
 * 跨模块依赖（决策 C）：
 *   filters.impact.affectsCustomerOrder = false → mustHumanIfCustomerKA 整行 disable
 *   理由：没勾选"影响客户订单"时，KA 客户的概念尚未在筛选阶段引入，
 *   把这条业务规则也置灰能让 ISV 看到"配置项之间的依赖关系"。
 */
export function AutomationModule() {
  return (
    <div className="space-y-4">
      <ModuleIntro />
      <SafetyLayer />
      <BusinessLayer />
      <EfficiencyLayer />
    </div>
  );
}

function ModuleIntro() {
  return (
    <p className="text-[12px] leading-relaxed text-muted">
      三层固定优先级：
      <span className="text-text">安全 &gt; 业务 &gt; 效率</span>。
      安全层永远赢——业务层的自动同意规则在安全层硬规则面前会被覆盖，
      冲突预警栏会实时显示哪一条业务规则在哪个场景下不生效。
    </p>
  );
}

// ── 安全层 ──────────────────────────────────────────

function SafetyLayer() {
  const lockReason = '安全层规则由平台硬约束。业务层和效率层的设置不能覆盖。';

  return (
    <ConfigCard
      title="安全层"
      icon={<Lock className="h-3.5 w-3.5" />}
      hint="不可关闭"
      action={<Badge tone="primary">硬规则</Badge>}
      className="border-l-4 border-l-primary bg-bg/40"
    >
      <ConfigRow
        label="影响在制工单 → 必须人工"
        description="订单影响在制工单时不允许自动同意供应商延期"
        control={<LockedToggle reason={lockReason} />}
      />
      <ConfigRow
        label="关键件 → 必须人工"
        description="关键件订单的延期决策永远由人工裁决"
        control={<LockedToggle reason={lockReason} />}
      />
      <ConfigRow
        label="单一来源 → 必须人工"
        description="单一来源料件供应风险高，必须人工评估"
        control={<LockedToggle reason={lockReason} />}
      />
      <ConfigRow
        label="财务合规事项 → 必须人工"
        description="涉及合规、税务、付款条款的变更不允许自动同意"
        control={<LockedToggle reason={lockReason} />}
      />
    </ConfigCard>
  );
}

// ── 业务层 ──────────────────────────────────────────

function BusinessLayer() {
  const business = useSkillStore((s) => s.config.automationBoundary.business);
  const affectsCustomerOrder = useSkillStore(
    (s) => s.config.filters.impact.affectsCustomerOrder,
  );
  const setConfig = useSkillStore((s) => s.setConfig);
  const overridden = useOverriddenPaths();

  const overriddenLabel = (path: string) =>
    overridden.has(path) ? '安全层' : undefined;

  return (
    <ConfigCard
      title="业务层"
      icon={<Sliders className="h-3.5 w-3.5" />}
      hint="可配置"
      action={<Badge tone="accent">业务策略</Badge>}
      className="border-l-4 border-l-accent"
    >
      {/* 自动同意 ≤ N 天 —— Toggle + Slider 嵌套 */}
      <ConfigRow
        label="延期 ≤ N 天自动同意"
        hint="供应商回复的延期天数不超过此值时，可绕过人工直接同意。仅在不触发安全层时生效。"
        overriddenBy={overriddenLabel(
          'automationBoundary.business.autoApproveIfDelayLE',
        )}
        control={
          <div className="flex flex-col gap-2">
            <Switch
              checked={business.autoApproveIfDelayLE.enabled}
              onCheckedChange={(v) =>
                setConfig((c) => {
                  c.automationBoundary.business.autoApproveIfDelayLE.enabled = v;
                })
              }
            />
            {business.autoApproveIfDelayLE.enabled && (
              <div className="flex items-center gap-3">
                <Slider
                  value={[business.autoApproveIfDelayLE.days]}
                  min={0}
                  max={7}
                  step={1}
                  className="w-40"
                  onValueChange={([v]) =>
                    setConfig((c) => {
                      c.automationBoundary.business.autoApproveIfDelayLE.days =
                        v ?? 2;
                    })
                  }
                />
                <span className="w-14 text-right text-[12px] font-semibold text-text">
                  ≤ {business.autoApproveIfDelayLE.days} 天
                </span>
              </div>
            )}
          </div>
        }
      />

      <ConfigRow
        label="供应商等级 A 自动同意"
        description="A 级供应商在不触发安全层时延期请求自动同意"
        overriddenBy={overriddenLabel(
          'automationBoundary.business.autoApproveTierA',
        )}
        control={
          <Switch
            checked={business.autoApproveTierA}
            onCheckedChange={(v) =>
              setConfig((c) => {
                c.automationBoundary.business.autoApproveTierA = v;
              })
            }
          />
        }
      />

      {/* 决策 C：客户重要性 ≥ KA 必须人工 —— 跨模块解锁 */}
      <ConfigRow
        label="客户重要性 ≥ KA 必须人工"
        description={
          affectsCustomerOrder
            ? '订单关联到 KA 或战略客户时强制人工复核'
            : '需先在「筛选规则 → 影响客户订单」中启用才能配置'
        }
        disabled={!affectsCustomerOrder}
        control={
          <Switch
            checked={business.mustHumanIfCustomerKA && affectsCustomerOrder}
            disabled={!affectsCustomerOrder}
            onCheckedChange={(v) =>
              setConfig((c) => {
                c.automationBoundary.business.mustHumanIfCustomerKA = v;
              })
            }
          />
        }
      />
    </ConfigCard>
  );
}

// ── 效率层 ──────────────────────────────────────────

function EfficiencyLayer() {
  const efficiency = useSkillStore(
    (s) => s.config.automationBoundary.efficiency,
  );
  const setConfig = useSkillStore((s) => s.setConfig);

  return (
    <ConfigCard
      title="效率层"
      icon={<Gauge className="h-3.5 w-3.5" />}
      hint="默认开启"
      action={<Badge tone="success">兜底约束</Badge>}
      className="border-l-4 border-l-success"
    >
      <ConfigRow
        label="跟催次数上限"
        description="单笔订单的二次跟催最多发送多少次，超过自动升级"
        control={
          <div className="flex items-center gap-3">
            <Slider
              value={[efficiency.maxFollowUpCount]}
              min={1}
              max={5}
              step={1}
              className="w-40"
              onValueChange={([v]) =>
                setConfig((c) => {
                  c.automationBoundary.efficiency.maxFollowUpCount = v ?? 3;
                })
              }
            />
            <span className="w-14 text-right text-[12px] font-semibold text-text">
              {efficiency.maxFollowUpCount} 次
            </span>
          </div>
        }
      />

      <ConfigRow
        label="自动同意金额上限"
        description="单笔订单金额超过此值即使满足业务层规则也必须人工"
        control={
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted">¥</span>
            <Input
              type="number"
              value={efficiency.autoApproveAmountLimit}
              onChange={(e) =>
                setConfig((c) => {
                  const next = Number(e.target.value);
                  c.automationBoundary.efficiency.autoApproveAmountLimit =
                    Number.isFinite(next) ? next : 0;
                })
              }
              className="w-32 font-mono"
              min={0}
              step={1000}
            />
            <span className="text-[11px] text-muted">元</span>
          </div>
        }
      />
    </ConfigCard>
  );
}
