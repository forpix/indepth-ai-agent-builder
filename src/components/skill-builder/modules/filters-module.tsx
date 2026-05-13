import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Calendar,
  Factory,
  Network,
} from 'lucide-react';

import { ConfigCard } from '@/components/skill-builder/shared/config-card';
import { ConfigRow } from '@/components/skill-builder/shared/config-row';
import { PillSelector } from '@/components/skill-builder/shared/pill-selector';
import { TristateSelector } from '@/components/skill-builder/shared/tristate-selector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useSkillStore } from '@/stores/skill-store';
import type {
  CustomerImportance,
  FilterMode,
  SupplierReplyStatus,
  SupplierTier,
} from '@/types/skill';

/**
 * 模块三：筛选规则 ⭐ —— spec §4。
 *
 * 4 张分组卡：时间 / 供应商 / 物料属性 / 影响范围。
 * 核心展示位：
 *   - PD-2 三态选择器（物料属性 3 行）
 *   - 隐式联动可视化（关键件/单一来源 = 是 → 物料属性卡右上角一行小字
 *     提示「→ 安全层强制人工复核」，是冲突预警的"预告"）
 *   - 主动 vs 被动模式切换 → 历史延期率阈值的 disable/enable
 *   - 影响客户订单 = 开 → 客户重要性下限的解锁高亮（1 秒）
 */
export function FiltersModule() {
  const filters = useSkillStore((s) => s.config.filters);
  const setConfig = useSkillStore((s) => s.setConfig);

  return (
    <div className="space-y-4">
      <ModuleIntro mode={filters.mode} onChangeMode={(next) =>
        setConfig((c) => {
          c.filters.mode = next;
        })
      } />

      <TimeCard
        dueInDays={filters.time.dueInDays}
        excludeCompleted={filters.time.excludeCompleted}
      />

      <SupplierCard
        replyStatus={filters.supplier.replyStatus}
        tier={filters.supplier.tier}
        delayRateThreshold={filters.supplier.delayRateThreshold}
        modeIsActive={filters.mode === 'active'}
      />

      <MaterialCard
        isCritical={filters.material.isCritical}
        isSingleSource={filters.material.isSingleSource}
        hasAlternative={filters.material.hasAlternative}
      />

      <ImpactCard
        affectsWorkOrder={filters.impact.affectsWorkOrder}
        affectsMRP={filters.impact.affectsMRP}
        affectsCustomerOrder={filters.impact.affectsCustomerOrder}
        customerImportanceFloor={filters.impact.customerImportanceFloor}
      />
    </div>
  );
}

// ── Intro + 模式切换 ─────────────────────────────────

interface ModuleIntroProps {
  mode: FilterMode;
  onChangeMode: (next: FilterMode) => void;
}

function ModuleIntro({ mode, onChangeMode }: ModuleIntroProps) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
      <p className="max-w-[60%] text-[12px] leading-relaxed text-muted">
        筛选模式决定本 Skill 何时去看订单：
        <span className="text-text">主动跟催</span> 全量扫描，
        <span className="text-text">被动响应</span> 仅在收到供应商回复事件时启动。
      </p>
      <div className="inline-flex h-8 overflow-hidden rounded-md border border-border bg-surface">
        {(['active', 'passive'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChangeMode(m)}
            className={cn(
              'px-3 text-[12px] transition-colors',
              mode === m
                ? 'bg-primary text-primary-foreground'
                : 'text-muted hover:text-text',
            )}
          >
            {m === 'active' ? '主动跟催' : '被动响应'}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 时间筛选 ────────────────────────────────────────

interface TimeCardProps {
  dueInDays: number;
  excludeCompleted: boolean;
}

function TimeCard({ dueInDays, excludeCompleted }: TimeCardProps) {
  const setConfig = useSkillStore((s) => s.setConfig);
  return (
    <ConfigCard
      title="时间筛选"
      icon={<Calendar className="h-3.5 w-3.5" />}
    >
      <ConfigRow
        label="到货前 N 天"
        hint="距离预计到货日还有多少天内的订单进入跟催范围。"
        control={
          <div className="flex items-center gap-3">
            <Slider
              value={[dueInDays]}
              min={1}
              max={14}
              step={1}
              className="flex-1"
              onValueChange={([v]) =>
                setConfig((c) => {
                  c.filters.time.dueInDays = v ?? 7;
                })
              }
            />
            <span className="w-10 text-right text-[12px] font-semibold text-text">
              {dueInDays} 天
            </span>
          </div>
        }
      />
      <ConfigRow
        label="排除已完结订单"
        description="过滤掉已收货 / 已关闭的历史订单"
        control={
          <Switch
            checked={excludeCompleted}
            onCheckedChange={(v) =>
              setConfig((c) => {
                c.filters.time.excludeCompleted = v;
              })
            }
          />
        }
      />
    </ConfigCard>
  );
}

// ── 供应商筛选 ──────────────────────────────────────

interface SupplierCardProps {
  replyStatus: SupplierReplyStatus[];
  tier: SupplierTier[];
  delayRateThreshold: number;
  modeIsActive: boolean;
}

function SupplierCard({
  replyStatus,
  tier,
  delayRateThreshold,
  modeIsActive,
}: SupplierCardProps) {
  const setConfig = useSkillStore((s) => s.setConfig);
  const pct = Math.round(delayRateThreshold * 100);

  return (
    <ConfigCard
      title="供应商筛选"
      icon={<Factory className="h-3.5 w-3.5" />}
    >
      <ConfigRow
        label="回复状态"
        control={
          <PillSelector<SupplierReplyStatus>
            options={[
              { value: 'notReplied', label: '未回复' },
              { value: 'repliedDelay', label: '已回复延期' },
              { value: 'repliedConfirm', label: '已回复确认' },
            ]}
            value={replyStatus}
            onChange={(next) =>
              setConfig((c) => {
                c.filters.supplier.replyStatus = next;
              })
            }
          />
        }
      />
      <ConfigRow
        label="供应商等级"
        control={
          <PillSelector<SupplierTier>
            options={[
              { value: 'A', label: 'A 级' },
              { value: 'B', label: 'B 级' },
              { value: 'C', label: 'C 级' },
            ]}
            value={tier}
            onChange={(next) =>
              setConfig((c) => {
                c.filters.supplier.tier = next;
              })
            }
          />
        }
      />
      <ConfigRow
        label="历史延期率阈值"
        description="供应商近 90 天延期订单占比超过该值才纳入跟催。"
        disabled={!modeIsActive}
        control={
          <div className="flex items-center gap-3">
            <Slider
              value={[pct]}
              min={0}
              max={100}
              step={5}
              className="flex-1"
              disabled={!modeIsActive}
              onValueChange={([v]) =>
                setConfig((c) => {
                  c.filters.supplier.delayRateThreshold = (v ?? 30) / 100;
                })
              }
            />
            <span className="w-10 text-right text-[12px] font-semibold text-text">
              {pct}%
            </span>
          </div>
        }
        trailing={
          !modeIsActive ? (
            <span className="text-[11px] text-muted">
              仅在「主动跟催」模式下生效，被动模式下供应商已回复才会触发
            </span>
          ) : undefined
        }
      />
    </ConfigCard>
  );
}

// ── 物料属性 + 隐式联动可视化 ────────────────────────

interface MaterialCardProps {
  isCritical: 'yes' | 'no' | 'any';
  isSingleSource: 'yes' | 'no' | 'any';
  hasAlternative: 'yes' | 'no' | 'any';
}

function MaterialCard({
  isCritical,
  isSingleSource,
  hasAlternative,
}: MaterialCardProps) {
  const setConfig = useSkillStore((s) => s.setConfig);

  // A2：触发联动的字段（关键件 / 单一来源 = 是 时显示完整提示）
  const linkedHint = getLinkedHint(isCritical, isSingleSource);

  return (
    <ConfigCard
      title="物料属性筛选"
      icon={<Boxes className="h-3.5 w-3.5" />}
      hint="PD-2：三态选择，处理「包含/排除/不约束」"
      action={
        linkedHint ? (
          <div className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2 py-1">
            <ArrowRight className="h-3 w-3 text-warning" />
            <span className="text-[11px] text-text">{linkedHint}</span>
          </div>
        ) : null
      }
    >
      <ConfigRow
        label="是否关键件"
        hint="选「是」会触发安全层强制人工，不可被业务层自动同意覆盖。"
        control={
          <TristateSelector
            value={isCritical}
            onChange={(v) =>
              setConfig((c) => {
                c.filters.material.isCritical = v;
              })
            }
          />
        }
      />
      <ConfigRow
        label="是否单一来源"
        hint="单一来源料件供应风险高，安全层会强制人工复核。"
        control={
          <TristateSelector
            value={isSingleSource}
            onChange={(v) =>
              setConfig((c) => {
                c.filters.material.isSingleSource = v;
              })
            }
          />
        }
      />
      <ConfigRow
        label="是否有替代料"
        control={
          <TristateSelector
            value={hasAlternative}
            onChange={(v) =>
              setConfig((c) => {
                c.filters.material.hasAlternative = v;
              })
            }
          />
        }
      />
    </ConfigCard>
  );
}

function getLinkedHint(
  isCritical: 'yes' | 'no' | 'any',
  isSingleSource: 'yes' | 'no' | 'any',
): string | null {
  const critical = isCritical === 'yes';
  const single = isSingleSource === 'yes';
  if (critical && single) {
    return '关键件 + 单一来源已选中 → 安全层强制人工复核';
  }
  if (critical) return '关键件已选中 → 安全层强制人工复核';
  if (single) return '单一来源已选中 → 安全层强制人工复核';
  return null;
}

// ── 影响范围 + 解锁高亮 ─────────────────────────────

interface ImpactCardProps {
  affectsWorkOrder: boolean;
  affectsMRP: boolean;
  affectsCustomerOrder: boolean;
  customerImportanceFloor: CustomerImportance;
}

function ImpactCard({
  affectsWorkOrder,
  affectsMRP,
  affectsCustomerOrder,
  customerImportanceFloor,
}: ImpactCardProps) {
  const setConfig = useSkillStore((s) => s.setConfig);

  // 影响客户订单从 false → true 时给 customerImportanceFloor 1 秒高亮，
  // 是"解锁"动作的视觉提示，让 ISV 知道这一行刚刚变得可用。
  const [highlight, setHighlight] = useState(false);
  const prevAffectsRef = useRef(affectsCustomerOrder);
  useEffect(() => {
    if (!prevAffectsRef.current && affectsCustomerOrder) {
      setHighlight(true);
      const id = window.setTimeout(() => setHighlight(false), 1000);
      return () => window.clearTimeout(id);
    }
    prevAffectsRef.current = affectsCustomerOrder;
    return undefined;
  }, [affectsCustomerOrder]);

  return (
    <ConfigCard
      title="影响范围筛选"
      icon={<Network className="h-3.5 w-3.5" />}
    >
      <ConfigRow
        label="影响在制工单"
        description="启用后会从 MES 拉取关联工单清单。"
        control={
          <Switch
            checked={affectsWorkOrder}
            onCheckedChange={(v) =>
              setConfig((c) => {
                c.filters.impact.affectsWorkOrder = v;
              })
            }
          />
        }
      />
      <ConfigRow
        label="影响 MRP 计划"
        description="启用后需要访问 MRP 模块的授权。"
        control={
          <Switch
            checked={affectsMRP}
            onCheckedChange={(v) =>
              setConfig((c) => {
                c.filters.impact.affectsMRP = v;
              })
            }
          />
        }
      />
      <ConfigRow
        label="影响客户订单"
        description="开启后解锁下方「客户重要性下限」。"
        control={
          <Switch
            checked={affectsCustomerOrder}
            onCheckedChange={(v) =>
              setConfig((c) => {
                c.filters.impact.affectsCustomerOrder = v;
              })
            }
          />
        }
      />
      <ConfigRow
        label="客户重要性下限"
        disabled={!affectsCustomerOrder}
        className={cn(
          'rounded-md transition-shadow',
          highlight && 'ring-2 ring-accent/40 ring-offset-2 ring-offset-surface',
        )}
        control={
          <Select
            value={customerImportanceFloor}
            disabled={!affectsCustomerOrder}
            onValueChange={(v) =>
              setConfig((c) => {
                c.filters.impact.customerImportanceFloor =
                  v as CustomerImportance;
              })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部客户</SelectItem>
              <SelectItem value="KA">仅 KA 客户</SelectItem>
              <SelectItem value="strategic">仅战略客户</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </ConfigCard>
  );
}
