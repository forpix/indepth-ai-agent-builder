import { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ClipboardCheck,
  FileWarning,
  Network,
  Repeat,
  Send,
} from 'lucide-react';

import { ConfigRow } from '@/components/skill-builder/shared/config-row';
import { PillSelector } from '@/components/skill-builder/shared/pill-selector';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  CallableSkillId,
  EscalateRole,
  NotifyChannel,
} from '@/types/skill';

type ActionCategory = '通知' | '标记' | '升级' | '派发' | '协同';

const CATEGORY_TONE: Record<ActionCategory, 'primary' | 'accent' | 'warning' | 'success'> = {
  通知: 'primary',
  标记: 'accent',
  升级: 'warning',
  派发: 'primary',
  协同: 'success',
};

/**
 * 模块四：动作配置 —— spec §5。
 *
 * 6 个动作分 5 类，每个动作是一张 Collapsible 卡：
 * 决策 E 选项 2：enabled=true 时默认展开；enabled=false 时折叠但可手动展开。
 *
 * 「调用其他 Skill」是多智能体协同 / MACP 协议钩子，需在 UI 上显眼标注。
 */
export function ActionsModule() {
  const actions = useSkillStore((s) => s.config.actions);
  const setConfig = useSkillStore((s) => s.setConfig);

  return (
    <div className="space-y-3">
      <ModuleIntro />

      <ActionCard
        category="通知"
        icon={<Send className="h-3.5 w-3.5" />}
        title="发送供应商跟催"
        subtitle="按配置渠道向供应商发送跟催信息"
        enabled={actions.sendSupplierReminder.enabled}
        onEnabledChange={(v) =>
          setConfig((c) => {
            c.actions.sendSupplierReminder.enabled = v;
          })
        }
      >
        <ConfigRow
          label="通知渠道"
          hint="任务卡是鼎捷雅典娜原生形态，企业微信用于供应商外协场景"
          control={
            <PillSelector<NotifyChannel>
              options={[
                { value: 'taskCard', label: '任务卡' },
                { value: 'enterpriseWechat', label: '企业微信' },
                { value: 'email', label: '邮件' },
              ]}
              value={actions.sendSupplierReminder.channels}
              onChange={(next) =>
                setConfig((c) => {
                  c.actions.sendSupplierReminder.channels = next;
                })
              }
            />
          }
        />
        <ConfigRow
          label="话术模板"
          control={
            <Select
              value={actions.sendSupplierReminder.templateId}
              onValueChange={(v) =>
                setConfig((c) => {
                  c.actions.sendSupplierReminder.templateId = v;
                })
              }
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard-reminder-v2">
                  标准跟催 v2
                </SelectItem>
                <SelectItem value="urgent-reminder">加急跟催</SelectItem>
                <SelectItem value="soft-reminder">礼貌提醒</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </ActionCard>

      <ActionCard
        category="标记"
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        title="标记加急"
        subtitle="把订单标记为加急状态，在订单列表里高亮显示"
        enabled={actions.markUrgent.enabled}
        onEnabledChange={(v) =>
          setConfig((c) => {
            c.actions.markUrgent.enabled = v;
          })
        }
      >
        <p className="text-[11px] leading-relaxed text-muted">
          启用后，命中本 Skill 的订单会同步联动「必须人工确认」流程（PD-8）。
        </p>
      </ActionCard>

      <ActionCard
        category="升级"
        icon={<Repeat className="h-3.5 w-3.5" />}
        title="发起二次跟催"
        subtitle="首次跟催后若仍未回复，按间隔自动二次跟催"
        enabled={actions.secondaryFollowUp.enabled}
        onEnabledChange={(v) =>
          setConfig((c) => {
            c.actions.secondaryFollowUp.enabled = v;
          })
        }
      >
        <ConfigRow
          label="间隔小时"
          description="距离首次跟催间隔多久后启动二次跟催"
          control={
            <div className="flex items-center gap-3">
              <Slider
                value={[actions.secondaryFollowUp.intervalHours]}
                min={2}
                max={72}
                step={2}
                className="w-48"
                onValueChange={([v]) =>
                  setConfig((c) => {
                    c.actions.secondaryFollowUp.intervalHours = v ?? 24;
                  })
                }
              />
              <span className="w-14 text-right text-[12px] font-semibold text-text">
                {actions.secondaryFollowUp.intervalHours} h
              </span>
            </div>
          }
          trailing={
            <span>
              受效率层「跟催次数上限」约束 —— 详见自动化边界模块
            </span>
          }
        />
      </ActionCard>

      <ActionCard
        category="升级"
        icon={<FileWarning className="h-3.5 w-3.5" />}
        title="创建异常任务"
        subtitle="超出跟催范围或触发安全层时升级到主管 / 总监"
        enabled={actions.createExceptionTask.enabled}
        onEnabledChange={(v) =>
          setConfig((c) => {
            c.actions.createExceptionTask.enabled = v;
          })
        }
      >
        <ConfigRow
          label="升级接收人"
          hint="异常任务的处理人；建议选采购线条管理者"
          control={
            <Select
              value={actions.createExceptionTask.escalateTo}
              onValueChange={(v) =>
                setConfig((c) => {
                  c.actions.createExceptionTask.escalateTo = v as EscalateRole;
                })
              }
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase-manager">采购主管</SelectItem>
                <SelectItem value="purchase-director">采购总监</SelectItem>
                <SelectItem value="plant-manager">厂长</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </ActionCard>

      <ActionCard
        category="派发"
        icon={<ClipboardCheck className="h-3.5 w-3.5" />}
        title="派发任务卡"
        subtitle="在鼎捷雅典娜的「任务卡」面板里给采购员推送处理项"
        enabled={actions.dispatchTaskCard.enabled}
        onEnabledChange={(v) =>
          setConfig((c) => {
            c.actions.dispatchTaskCard.enabled = v;
          })
        }
      >
        <p className="text-[11px] leading-relaxed text-muted">
          任务卡是鼎捷雅典娜的原生通知形态（PD-9），区别于"消息"或"通知"。
          采购员在任务卡里可以一键完成确认 / 转派 / 备注。
        </p>
      </ActionCard>

      {/* 多智能体协同钩子 —— MACP 协议入口 */}
      <ActionCard
        category="协同"
        icon={<Network className="h-3.5 w-3.5" />}
        title={
          <span className="inline-flex items-center gap-2">
            调用其他 Skill
            <Badge tone="success">多智能体协同</Badge>
          </span>
        }
        subtitle="在本 Skill 内调用其他 Skill，组成跨域协作链路"
        enabled={actions.callSkill.enabled}
        onEnabledChange={(v) =>
          setConfig((c) => {
            c.actions.callSkill.enabled = v;
            if (!v) c.actions.callSkill.targetSkill = null;
          })
        }
      >
        <ConfigRow
          label="目标 Skill"
          hint="选择被调用的 Skill。3 个 mock Skill 演示 MACP 协议下的协同形态。"
          control={
            <Select
              value={actions.callSkill.targetSkill ?? undefined}
              onValueChange={(v) =>
                setConfig((c) => {
                  c.actions.callSkill.targetSkill = v as CallableSkillId;
                })
              }
            >
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="选择要调用的 Skill" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completenessAlert">
                  齐套预警 Skill
                </SelectItem>
                <SelectItem value="supplierRiskAssessment">
                  供应商风险评估 Skill
                </SelectItem>
                <SelectItem value="exceptionWorkOrderEscalation">
                  异常工单升级 Skill
                </SelectItem>
              </SelectContent>
            </Select>
          }
        />
        <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-[11px] leading-relaxed text-text">
          ⭐ <span className="font-semibold">多智能体协同入口 · MACP 协议</span>
          ：本 Skill 在执行过程中可以调用上述任一 Skill 形成协作链路，
          例如采购跟催 → 触发齐套预警 → 升级到异常工单 Skill。
          具体调用时机、参数透传、回调约定由 MACP 协议规范。
        </div>
      </ActionCard>
    </div>
  );
}

function ModuleIntro() {
  return (
    <p className="text-[12px] leading-relaxed text-muted">
      动作配置定义本 Skill 命中筛选后执行什么。6 个动作分为
      <span className="text-text">通知 / 标记 / 升级 / 派发 / 协同</span> 五类，
      其中「调用其他 Skill」是 MACP 多智能体协同的产品入口。
    </p>
  );
}

// ── Collapsible 动作卡 ─────────────────────────────

interface ActionCardProps {
  category: ActionCategory;
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  children: React.ReactNode;
}

function ActionCard({
  category,
  icon,
  title,
  subtitle,
  enabled,
  onEnabledChange,
  children,
}: ActionCardProps) {
  // enabled=true 默认展开；用户也可以手动开合
  const [manualOpen, setManualOpen] = useState(false);
  const open = enabled || manualOpen;

  return (
    <Collapsible
      open={open}
      onOpenChange={(o) => setManualOpen(o)}
      className={cn(
        'rounded-lg border border-border bg-surface',
        enabled && 'border-l-4 border-l-accent',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-bg hover:text-text"
            aria-label={open ? '折叠' : '展开'}
          >
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>

        <span className="text-muted">{icon}</span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
            {title}
            <Badge tone={CATEGORY_TONE[category]}>{category}</Badge>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted">{subtitle}</div>
        </div>

        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>

      <CollapsibleContent>
        <div className="space-y-3 border-t border-border bg-bg/30 px-4 py-3">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
