import { CalendarClock, Hand, MessageSquare, Zap } from 'lucide-react';

import { ConfigCard } from '@/components/skill-builder/shared/config-card';
import { ConfigRow } from '@/components/skill-builder/shared/config-row';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSkillStore } from '@/stores/skill-store';
import type { EventSource } from '@/types/skill';

/**
 * 模块二：触发方式 —— spec §3。
 *
 * 产品判断：四种触发方式并存，但**优先级隐含**。
 * 事件触发响应业务变动最快，优先级最高；定时触发兜底；自然语言触发是 Agent 入口；
 * 手动触发用于例外。优先级用 Badge inline 标注，让 ISV 看一眼就懂为什么不是"四选一"。
 */
export function TriggersModule() {
  const triggers = useSkillStore((s) => s.config.triggers);
  const setConfig = useSkillStore((s) => s.setConfig);

  const cronHuman = humanizeCron(triggers.schedule.cron);

  return (
    <div className="space-y-4">
      <ModuleIntro />

      <ConfigCard title="触发方式" hint="启用至少一种">
        {/* 1) 事件触发 —— 优先级最高 */}
        <ConfigRow
          label={
            <span className="inline-flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-accent" />
              事件触发
              <Badge tone="accent">优先级最高</Badge>
            </span>
          }
          description="业务变动（MRP 计划变动、工单插单等）发生时立即执行 Skill"
          control={
            <Switch
              checked={triggers.event.enabled}
              onCheckedChange={(checked) =>
                setConfig((c) => {
                  c.triggers.event.enabled = checked;
                })
              }
            />
          }
        />

        {/* 事件源 Checkbox 列表（仅启用时显示） */}
        {triggers.event.enabled && (
          <div className="ml-4 grid grid-cols-2 gap-2 rounded-md border border-dashed border-border bg-bg/50 p-3">
            <EventSourceCheckbox
              source="mrp.plan.changed"
              label="MRP 计划变动"
              checked={triggers.event.sources.includes('mrp.plan.changed')}
            />
            <EventSourceCheckbox
              source="workorder.inserted"
              label="工单插单"
              checked={triggers.event.sources.includes('workorder.inserted')}
            />
            <EventSourceCheckbox
              source="po.created"
              label="采购单新建"
              checked={triggers.event.sources.includes('po.created')}
            />
            <EventSourceCheckbox
              source="supplier.replied"
              label="供应商回复"
              checked={triggers.event.sources.includes('supplier.replied')}
            />
          </div>
        )}

        <Divider />

        {/* 2) 定时触发 —— 兜底 */}
        <ConfigRow
          label={
            <span className="inline-flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5 text-muted" />
              定时触发
              <Badge tone="primary">兜底</Badge>
            </span>
          }
          description="即使事件未触发，也保证按节奏检查一次"
          control={
            <Switch
              checked={triggers.schedule.enabled}
              onCheckedChange={(checked) =>
                setConfig((c) => {
                  c.triggers.schedule.enabled = checked;
                })
              }
            />
          }
        />

        {triggers.schedule.enabled && (
          <div className="ml-4 flex items-center gap-3 rounded-md border border-dashed border-border bg-bg/50 p-3">
            <Label htmlFor="cron-input" className="shrink-0">
              Cron 表达式
            </Label>
            <Input
              id="cron-input"
              value={triggers.schedule.cron}
              onChange={(e) =>
                setConfig((c) => {
                  c.triggers.schedule.cron = e.target.value;
                })
              }
              className="font-mono"
              placeholder="0 8 * * *"
            />
            <span className="shrink-0 text-[11px] text-muted">→ {cronHuman}</span>
          </div>
        )}

        <Divider />

        {/* 3) 自然语言触发 —— Agent 入口 */}
        <ConfigRow
          label={
            <span className="inline-flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-muted" />
              自然语言触发
              <Badge tone="default">Agent 入口</Badge>
            </span>
          }
          description="启用后 Agent Console 可以调用本 Skill"
          control={
            <Switch
              checked={triggers.naturalLanguage.enabled}
              onCheckedChange={(checked) =>
                setConfig((c) => {
                  c.triggers.naturalLanguage.enabled = checked;
                })
              }
            />
          }
        />

        <Divider />

        {/* 4) 手动触发 —— 例外 */}
        <ConfigRow
          label={
            <span className="inline-flex items-center gap-2">
              <Hand className="h-3.5 w-3.5 text-muted" />
              手动触发
              <Badge tone="default">例外</Badge>
            </span>
          }
          description="人工干预、补跑、回溯等例外场景"
          control={
            <Switch
              checked={triggers.manual.enabled}
              onCheckedChange={(checked) =>
                setConfig((c) => {
                  c.triggers.manual.enabled = checked;
                })
              }
            />
          }
        />
      </ConfigCard>
    </div>
  );
}

function ModuleIntro() {
  return (
    <p className="text-[12px] leading-relaxed text-muted">
      四种触发方式并存，但优先级隐含：
      <span className="text-text">事件触发 &gt; 定时触发 &gt; 自然语言 &gt; 手动</span>。
      真实 ISV 场景里这四种触发往往同时存在，所以不是「四选一」单选，而是「至少启用一种」多选。
    </p>
  );
}

function Divider() {
  return <div className="-mx-4 border-t border-border" />;
}

interface EventSourceCheckboxProps {
  source: EventSource;
  label: string;
  checked: boolean;
}

function EventSourceCheckbox({ source, label, checked }: EventSourceCheckboxProps) {
  const setConfig = useSkillStore((s) => s.setConfig);
  const id = `event-source-${source}`;

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => {
          setConfig((c) => {
            const set = new Set(c.triggers.event.sources);
            if (next) set.add(source);
            else set.delete(source);
            c.triggers.event.sources = Array.from(set);
          });
        }}
      />
      <Label htmlFor={id} className="cursor-pointer">
        {label}
      </Label>
    </div>
  );
}

/**
 * 极简 cron 翻译 —— 只覆盖 demo 中可能用到的常见模式，不做通用解析。
 * D-5：不引入 cron 可视化组件，纯文本框 + 一行解释。
 */
function humanizeCron(expr: string): string {
  const trimmed = expr.trim();
  // 仅识别 "m h * * *" 形式（每天定时）
  const match = trimmed.match(/^(\d+)\s+(\d+)\s+\*\s+\*\s+\*$/);
  if (match) {
    const [, minute, hour] = match;
    const m = String(minute ?? '0').padStart(2, '0');
    const h = String(hour ?? '0').padStart(2, '0');
    return `每天 ${h}:${m}`;
  }
  if (trimmed === '*/30 * * * *') return '每 30 分钟';
  if (trimmed === '0 * * * *') return '每小时整点';
  return '自定义表达式';
}
