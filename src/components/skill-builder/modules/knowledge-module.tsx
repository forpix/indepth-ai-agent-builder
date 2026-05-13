import { BookOpen, ShieldAlert } from 'lucide-react';

import { ConfigCard } from '@/components/skill-builder/shared/config-card';
import { ConfigRow } from '@/components/skill-builder/shared/config-row';
import { PillSelector } from '@/components/skill-builder/shared/pill-selector';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useSkillStore } from '@/stores/skill-store';
import type {
  KnowledgeSource,
  RetrievalFallback,
  RetrievalGranularity,
  RetrievalTrigger,
} from '@/types/skill';

/**
 * 模块七：知识检索（RAG 钩子）—— spec §8。
 *
 * 产品判断：「检索失败兜底」必须显式配置 —— 把失败作为一等公民处理，
 * 是企业级 Agent 区别于 Demo 的关键。
 */
export function KnowledgeModule() {
  const knowledge = useSkillStore((s) => s.config.knowledgeRetrieval);
  const setConfig = useSkillStore((s) => s.setConfig);
  const topKPct = knowledge.topK;
  const threshold = Math.round(knowledge.similarityThreshold * 100);

  return (
    <div className="space-y-4">
      <ModuleIntro />

      <ConfigCard
        title="知识源 & 检索时机"
        icon={<BookOpen className="h-3.5 w-3.5" />}
      >
        <ConfigRow
          label="引用知识源"
          hint="不同知识源对应不同业务场景；可多选"
          control={
            <PillSelector<KnowledgeSource>
              options={[
                { value: 'supplier-profile', label: '供应商档案' },
                { value: 'contract-history', label: '历史合同' },
                {
                  value: 'material-alternative-rules',
                  label: '物料替代规则',
                },
                { value: 'industry-benchmark', label: '行业基准' },
              ]}
              value={knowledge.sources}
              onChange={(next) =>
                setConfig((c) => {
                  c.knowledgeRetrieval.sources = next;
                })
              }
            />
          }
        />
        <ConfigRow
          label="检索时机"
          description="在哪些内部任务执行时触发 RAG 检索"
          control={
            <PillSelector<RetrievalTrigger>
              options={[
                { value: 'narrativeGeneration', label: '话术生成' },
                { value: 'riskAssessment', label: '风险判断' },
                { value: 'anomalyDiagnosis', label: '异常诊断' },
              ]}
              value={knowledge.triggerOn}
              onChange={(next) =>
                setConfig((c) => {
                  c.knowledgeRetrieval.triggerOn = next;
                })
              }
            />
          }
        />
        <ConfigRow
          label="检索粒度"
          hint="决定 RAG 检索时如何聚合知识切片"
          control={
            <GranularitySegmented
              value={knowledge.granularity}
              onChange={(next) =>
                setConfig((c) => {
                  c.knowledgeRetrieval.granularity = next;
                })
              }
            />
          }
        />
      </ConfigCard>

      <ConfigCard title="召回参数">
        <ConfigRow
          label="Top-K"
          description="每次检索返回的最相关切片数"
          control={
            <div className="flex items-center gap-3">
              <Slider
                value={[topKPct]}
                min={1}
                max={20}
                step={1}
                className="w-48"
                onValueChange={([v]) =>
                  setConfig((c) => {
                    c.knowledgeRetrieval.topK = v ?? 5;
                  })
                }
              />
              <span className="w-12 text-right text-[12px] font-semibold text-text">
                K = {topKPct}
              </span>
            </div>
          }
        />
        <ConfigRow
          label="相似度阈值"
          description="低于阈值的切片视为未命中，纳入失败兜底逻辑"
          control={
            <div className="flex items-center gap-3">
              <Slider
                value={[threshold]}
                min={0}
                max={100}
                step={5}
                className="w-48"
                onValueChange={([v]) =>
                  setConfig((c) => {
                    c.knowledgeRetrieval.similarityThreshold =
                      (v ?? 70) / 100;
                  })
                }
              />
              <span className="w-12 text-right text-[12px] font-semibold text-text">
                {(threshold / 100).toFixed(2)}
              </span>
            </div>
          }
        />
      </ConfigCard>

      {/* PD 强调位：失败兜底必须显式 */}
      <ConfigCard
        title="检索失败兜底"
        icon={<ShieldAlert className="h-3.5 w-3.5" />}
        hint="失败作为一等公民配置"
        action={<Badge tone="warning">企业级关键项</Badge>}
        className="border-l-4 border-l-warning"
      >
        <ConfigRow
          label="检索失败时的策略"
          hint="RAG 失败时（向量库超时 / 命中切片都低于阈值 / 知识源未配置）的行为"
          control={
            <Select
              value={knowledge.fallbackStrategy}
              onValueChange={(v) =>
                setConfig((c) => {
                  c.knowledgeRetrieval.fallbackStrategy = v as RetrievalFallback;
                })
              }
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="useDefaultNarrative">
                  使用默认话术
                </SelectItem>
                <SelectItem value="escalateToHuman">转人工</SelectItem>
                <SelectItem value="skipStep">跳过该步骤</SelectItem>
              </SelectContent>
            </Select>
          }
        />
        <p className="text-[11px] leading-relaxed text-muted">
          RAG 在工程上经常失败 —— 平台必须让 ISV
          显式决定失败时怎么办。把"失败"作为一等配置项，是企业级 Agent 区别于 Demo
          的关键。
        </p>
      </ConfigCard>
    </div>
  );
}

function ModuleIntro() {
  return (
    <p className="text-[12px] leading-relaxed text-muted">
      RAG 检索为话术生成、风险判断、异常诊断提供领域知识。
      <span className="text-text">「检索失败兜底」</span>
      必须显式配置 —— 失败是工程现实，不是产品瑕疵。
    </p>
  );
}

// ── 三态 Segmented（粒度专用） ──────────────────────

interface GranularitySegmentedProps {
  value: RetrievalGranularity;
  onChange: (next: RetrievalGranularity) => void;
}

function GranularitySegmented({ value, onChange }: GranularitySegmentedProps) {
  const options: Array<{ key: RetrievalGranularity; label: string; hint: string }> = [
    { key: 'supplier', label: '供应商级', hint: '按供应商聚合' },
    { key: 'material', label: '物料级', hint: '按物料编码聚合' },
    { key: 'order', label: '订单级', hint: '按订单维度聚合' },
  ];

  return (
    <div
      role="radiogroup"
      className="inline-flex h-7 overflow-hidden rounded-md border border-border bg-surface"
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.hint}
            onClick={() => onChange(opt.key)}
            className={cn(
              'border-r border-border px-3 text-[12px] transition-colors last:border-r-0',
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface text-muted hover:bg-bg hover:text-text',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
