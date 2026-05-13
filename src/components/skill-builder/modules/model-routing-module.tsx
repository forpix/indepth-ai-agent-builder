import { CircleDot } from 'lucide-react';

import { ConfigCard } from '@/components/skill-builder/shared/config-card';
import { ConfigRow } from '@/components/skill-builder/shared/config-row';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useSkillStore } from '@/stores/skill-store';
import type { ModelId, ModelRouting, RoutingMode } from '@/types/skill';

/**
 * 模块六：模型路由 —— spec §7 · PD-10 显式型号。
 *
 * 4 选 1 路由模式 + 6 个任务类型 × 模型 Select +
 * v1→v2→v3 演进路线时间线（决策 F 选项 2）。
 */
export function ModelRoutingModule() {
  const routing = useSkillStore((s) => s.config.modelRouting);
  const setConfig = useSkillStore((s) => s.setConfig);

  return (
    <div className="space-y-4">
      <ModuleIntro />

      <ConfigCard title="路由模式" hint="决定模型如何被分配到任务">
        <RadioGroup
          value={routing.mode}
          onValueChange={(v) =>
            setConfig((c) => {
              c.modelRouting.mode = v as RoutingMode;
            })
          }
          className="grid grid-cols-2 gap-2"
        >
          <ModeOption
            value="static"
            title="静态配置"
            description="按任务类型固定，启动即生效"
            active={routing.mode === 'static'}
          />
          <ModeOption
            value="dynamic"
            title="动态路由"
            description="按 Token 数 + 任务复杂度切换模型"
            active={routing.mode === 'dynamic'}
          />
          <ModeOption
            value="costFirst"
            title="成本优先"
            description="能完成任务的最便宜模型胜出"
            active={routing.mode === 'costFirst'}
          />
          <ModeOption
            value="performanceFirst"
            title="性能优先"
            description="不计成本，永远用最强的模型"
            active={routing.mode === 'performanceFirst'}
          />
        </RadioGroup>
      </ConfigCard>

      <ConfigCard
        title="任务级模型分配"
        hint="6 个内部任务类型 × 8 个候选模型"
        action={<Badge tone="primary">PD-10 显式型号</Badge>}
      >
        <TaskModelRow
          taskKey="intentDetection"
          label="意图识别"
          description="判断用户消息属于跟催 / 查询 / 投诉等哪类意图"
          recommendedHint="推荐：DeepSeek-V3、Qwen-Plus（轻量、快响应）"
          value={routing.routes.intentDetection}
        />
        <TaskModelRow
          taskKey="slotExtraction"
          label="槽位提取"
          description="从对话或工单里抽出订单号、物料编码、日期等结构化参数"
          recommendedHint="推荐：DeepSeek-V3、Qwen-Plus"
          value={routing.routes.slotExtraction}
        />
        <TaskModelRow
          taskKey="riskAssessment"
          label="风险判断"
          description="评估订单延期对在制工单、客户订单的影响程度"
          recommendedHint="推荐：GPT-4、DeepSeek-R1、Claude Sonnet（强推理）"
          value={routing.routes.riskAssessment}
        />
        <TaskModelRow
          taskKey="anomalyDiagnosis"
          label="异常诊断"
          description="分析跟催失败的根因，给出改进建议"
          recommendedHint="推荐：GPT-4、DeepSeek-R1（多步推理）"
          value={routing.routes.anomalyDiagnosis}
        />
        <TaskModelRow
          taskKey="narrativeGeneration"
          label="话术生成"
          description="为供应商跟催 / 升级任务生成自然语言文案"
          recommendedHint="推荐：Qwen-Max、文心一言-4（中文表达力）"
          value={routing.routes.narrativeGeneration}
        />
        <TaskModelRow
          taskKey="sensitive"
          label="敏感数据场景"
          description="涉及财务、合规、供应商保密协议的对话"
          recommendedHint="必须使用私有化部署模型，避免敏感数据出域"
          value={routing.routes.sensitive}
        />
      </ConfigCard>

      <RoadmapTimeline />
    </div>
  );
}

function ModuleIntro() {
  return (
    <p className="text-[12px] leading-relaxed text-muted">
      呼应鼎捷 Indepth AI 多模型集成的工程现状（DeepSeek / GPT / 通义千问 / 文心一言 /
      私有化）。任务级模型分配让每个内部任务用最合适的模型，敏感数据场景强制走私有化。
    </p>
  );
}

// ── 路由模式选项卡 ─────────────────────────────────

interface ModeOptionProps {
  value: RoutingMode;
  title: string;
  description: string;
  active: boolean;
}

function ModeOption({ value, title, description, active }: ModeOptionProps) {
  return (
    <Label
      htmlFor={`mode-${value}`}
      className={cn(
        'flex cursor-pointer items-start gap-2 rounded-md border bg-surface p-3 transition-colors',
        active
          ? 'border-accent bg-accent/5'
          : 'border-border hover:border-muted',
      )}
    >
      <RadioGroupItem
        id={`mode-${value}`}
        value={value}
        className="mt-0.5"
      />
      <div className="flex-1">
        <div className="text-[12px] font-semibold text-text">{title}</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-muted">
          {description}
        </div>
      </div>
    </Label>
  );
}

// ── 任务 → 模型选择行 ───────────────────────────────

interface TaskModelRowProps {
  taskKey: keyof ModelRouting['routes'];
  label: string;
  description: string;
  recommendedHint: string;
  value: ModelId;
}

const MODEL_OPTIONS: Array<{ value: ModelId; label: string; vendor: string }> = [
  { value: 'deepseek-v3', label: 'DeepSeek-V3', vendor: '深度求索' },
  { value: 'deepseek-r1', label: 'DeepSeek-R1', vendor: '深度求索' },
  { value: 'gpt-4', label: 'GPT-4', vendor: 'OpenAI' },
  { value: 'claude-sonnet', label: 'Claude Sonnet', vendor: 'Anthropic' },
  { value: 'qwen-plus', label: 'Qwen-Plus', vendor: '阿里通义' },
  { value: 'qwen-max', label: 'Qwen-Max', vendor: '阿里通义' },
  { value: 'wenxin-4', label: '文心一言 4', vendor: '百度' },
  { value: 'private-qwen', label: '私有化-Qwen', vendor: '本地部署' },
];

function TaskModelRow({
  taskKey,
  label,
  description,
  recommendedHint,
  value,
}: TaskModelRowProps) {
  const setConfig = useSkillStore((s) => s.setConfig);

  return (
    <ConfigRow
      label={label}
      hint={recommendedHint}
      description={description}
      control={
        <Select
          value={value}
          onValueChange={(v) =>
            setConfig((c) => {
              c.modelRouting.routes[taskKey] = v as ModelId;
            })
          }
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center justify-between gap-3">
                  <span>{opt.label}</span>
                  <span className="text-[10px] text-muted">{opt.vendor}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}

// ── 演进路线时间线（决策 F 选项 2） ──────────────────

const ROADMAP_STAGES = [
  {
    version: 'v1',
    title: '静态配置',
    detail: '按任务类型固定路由',
    state: 'current' as const,
  },
  {
    version: 'v2',
    title: '动态触发',
    detail: '按 Token 数 + 复杂度切换',
    state: 'next' as const,
  },
  {
    version: 'v3',
    title: '自适应',
    detail: '基于历史 ROI 自学习',
    state: 'future' as const,
  },
];

function RoadmapTimeline() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[12px] font-semibold text-text">
          模型路由产品路线图
        </div>
        <span className="text-[11px] text-muted">
          演进路径，不一定全部交付
        </span>
      </div>

      <div className="relative px-2">
        {/* 横向连接线 */}
        <div className="absolute left-8 right-8 top-3 h-px bg-border" />

        <ol className="relative grid grid-cols-3 gap-4">
          {ROADMAP_STAGES.map((stage) => {
            const isCurrent = stage.state === 'current';
            return (
              <li
                key={stage.version}
                className="flex flex-col items-center text-center"
              >
                <div
                  className={cn(
                    'relative flex h-6 w-6 items-center justify-center rounded-full border-2 bg-surface',
                    isCurrent
                      ? 'border-accent shadow-[0_0_0_3px_rgba(14,165,233,0.15)]'
                      : 'border-border',
                  )}
                >
                  {isCurrent ? (
                    <CircleDot className="h-3 w-3 text-accent" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-border" />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className={cn(
                      'text-[12px] font-semibold',
                      isCurrent ? 'text-accent' : 'text-muted',
                    )}
                  >
                    {stage.version}
                  </span>
                  {isCurrent && <Badge tone="accent">当前</Badge>}
                </div>
                <div
                  className={cn(
                    'mt-0.5 text-[12px] font-medium',
                    isCurrent ? 'text-text' : 'text-muted',
                  )}
                >
                  {stage.title}
                </div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-muted">
                  {stage.detail}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
