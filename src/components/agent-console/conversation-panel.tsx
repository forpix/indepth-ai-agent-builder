import { useEffect, useMemo, useRef } from 'react';
import { Bell, Brain, ChevronDown, Clock, MessageSquare, Zap } from 'lucide-react';

import { TIMINGS } from '@/lib/scenario-timings';
import { COT_TRACES } from '@/mocks/cot-traces';
import { messagesUpToStep } from '@/mocks/conversation-scripts';
import { useScenarioStore } from '@/stores/scenario-store';
import { useStreamingText } from '@/hooks/use-streaming-text';
import { isRealLlmEnabled } from '@/hooks/use-real-llm';
import { SCENARIO_STEP_INDEX, type ChatMessage } from '@/types/agent';
import { cn } from '@/lib/utils';

export function ConversationPanel() {
  const currentStep = useScenarioStore((s) => s.currentStep);
  const stepIndex = SCENARIO_STEP_INDEX[currentStep];

  const messages = useMemo(() => messagesUpToStep(stepIndex), [stepIndex]);

  // 新消息进来时自动滚动到底
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold">
          <MessageSquare className="h-3.5 w-3.5 text-muted" />
          对话面板
        </div>
        <div className="text-[10px] text-muted">
          {messages.length > 0 ? `${messages.length} 条消息` : '等待触发'}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m) => <MessageRow key={m.id} message={m} />)
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-[11px] text-muted">
      <Bell className="h-5 w-5 opacity-50" />
      <div>剧本未启动</div>
      <div className="text-[10px]">点击右上角「启动剧本」开始</div>
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  if (message.kind === 'system') {
    return (
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-3 py-1 text-[11px] text-muted">
          {message.icon === 'clock' && <Clock className="h-3 w-3" />}
          {message.icon === 'bolt' && <Zap className="h-3 w-3" />}
          {message.text}
        </div>
      </div>
    );
  }

  if (message.kind === 'reference') {
    return (
      <div className="rounded-md border-l-2 border-accent bg-accent/5 px-3 py-2 text-[11px] text-text">
        <span className="text-muted">引用 · </span>
        {message.text}
      </div>
    );
  }

  if (message.kind === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg border border-border bg-surface px-3 py-2 text-[12px] text-text">
          {message.text}
        </div>
      </div>
    );
  }

  // agent
  return <AgentMessage message={message} />;
}

function AgentMessage({ message }: { message: ChatMessage }) {
  const llmReplacements = useScenarioStore((s) => s.llmReplacements);
  const realLlm = isRealLlmEnabled();

  // L3 替换：Step 4 PO-005 解释（msg-007）；real 模式下等 LLM 返回再开始渲染
  const isL3Target = message.id === 'msg-007';
  const l3Replacement = llmReplacements.answerExplanation?.text;
  const waitingForL3 = realLlm && isL3Target && !l3Replacement;
  // ⚠️ effectiveText 必须用 isL3Target gate —— 否则 L3 输出会污染所有 Agent 消息
  const effectiveText =
    isL3Target && l3Replacement ? l3Replacement : message.text;

  // L1 替换：Step 3 思考链
  const cotLines =
    message.step === 3 && llmReplacements.riskCot
      ? llmReplacements.riskCot
      : COT_TRACES[message.step] ?? null;

  const { displayed, isComplete } = useStreamingText(effectiveText, {
    speed: TIMINGS.typingSpeed,
    enabled: message.streaming === true && !waitingForL3,
  });
  const cotExpandedStep = useScenarioStore((s) => s.cotExpandedStep);
  const toggleCot = useScenarioStore((s) => s.toggleCot);
  const isCotOpen = cotExpandedStep === message.step;

  if (waitingForL3) {
    return (
      <div className="flex justify-start">
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] italic text-muted">
          <span className="font-medium text-primary">Agent</span> 正在调用真 LLM
          (moonshot-v1-32k)...
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          'max-w-[88%] rounded-lg border px-3 py-2 text-[12px] leading-relaxed',
          'border-primary/20 bg-primary/5 text-text',
        )}
      >
        <div className="mb-1 text-[10px] font-medium text-primary">
          Agent · 制造业采购交期跟催
        </div>
        <div>
          {displayed}
          {!isComplete && (
            <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-primary/60 align-middle" />
          )}
        </div>

        {isComplete && cotLines && (
          <>
            <button
              type="button"
              onClick={() => toggleCot(message.step)}
              className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-accent hover:underline"
            >
              <Brain className="h-2.5 w-2.5" />
              {isCotOpen ? '收起思考链' : '展开思考链（CoT）'}
              <ChevronDown
                className={cn(
                  'h-2.5 w-2.5 transition-transform',
                  isCotOpen && 'rotate-180',
                )}
              />
            </button>
            {isCotOpen && (
              <ol className="mt-1.5 space-y-0.5 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-[10px] leading-relaxed text-muted">
                {cotLines.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </div>
  );
}
