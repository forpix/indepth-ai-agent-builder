/**
 * 真 LLM 接入 client —— 4 个 endpoint fetch 封装 + 失败时静默 fallback。
 *
 * 详见 docs/demo_scripts.md §2 + src/worker/llm.ts。
 *
 * 失败策略（spec §2.3 ⑤）：任何非 200 响应 → 抛 LlmFetchError，
 * 调用方 try/catch 后走 mock 路径，trace 记录 fallbackReason。
 */

import { getRealLlmToken } from '@/hooks/use-real-llm';
import type { PurchaseOrder } from '@/types/mock-data';
import type { AutomationBoundary, FilterConfig } from '@/types/skill';

const LLM_BASE = '/agent-builder/api/llm';

export class LlmFetchError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
  ) {
    super(`LLM fetch failed (${status}): ${reason}`);
    this.name = 'LlmFetchError';
  }
}

async function callLlm<TInput, TOutput>(
  endpoint: 'risk-judge' | 'orchestrate-call' | 'answer-question' | 'parse-config-intent',
  input: TInput,
): Promise<TOutput> {
  const token = getRealLlmToken();
  if (!token) {
    throw new LlmFetchError(0, 'token_missing');
  }
  const url = `${LLM_BASE}/${endpoint}?real-llm=${encodeURIComponent(token)}`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch (e) {
    throw new LlmFetchError(0, `network_error:${e instanceof Error ? e.message : 'unknown'}`);
  }
  if (!resp.ok) {
    let reason = `http_${resp.status}`;
    try {
      const errBody = (await resp.json()) as { error?: string };
      if (errBody.error) reason = errBody.error;
    } catch {
      // 忽略 JSON 解析失败，用默认 reason
    }
    throw new LlmFetchError(resp.status, reason);
  }
  return (await resp.json()) as TOutput;
}

// ─── L1 风险综合判断 ───────────────────────────────────

export interface L1Input {
  order: PurchaseOrder;
  config: {
    safety: AutomationBoundary['safety'];
    business: AutomationBoundary['business'];
  };
}
export interface L1Output {
  riskLevel: 'high' | 'medium' | 'low';
  safetyBlocked: boolean;
  recommendation: 'humanIntervene' | 'autoDispatchTaskCard' | 'autoApprove';
  cot: string[];
}
export function callRiskJudge(input: L1Input): Promise<L1Output> {
  return callLlm<L1Input, L1Output>('risk-judge', input);
}

// ─── L2 callSkill 编排 ────────────────────────────────

export interface L2Input {
  order: PurchaseOrder;
  riskLevel: 'high' | 'medium' | 'low';
  affectedWorkOrderIds: string[];
}
export interface L2Output {
  shouldCall: boolean;
  request: {
    callerSkillId: 'purchaseFollowUp';
    targetOrderId: string;
    affectedWorkOrderIds: string[];
    timeoutMs: number;
  } | null;
  reasoning: string;
}
export function callOrchestrate(input: L2Input): Promise<L2Output> {
  return callLlm<L2Input, L2Output>('orchestrate-call', input);
}

// ─── L3 自然语言追问 ───────────────────────────────────

export interface L3Input {
  question: string;
  orderContext: PurchaseOrder;
  appliedRules: string[];
  decisionResult: string;
  filterConfig?: FilterConfig;
}
export interface L3Output {
  explanation: string;
  citedRules: string[];
}
export function callAnswerQuestion(input: L3Input): Promise<L3Output> {
  return callLlm<L3Input, L3Output>('answer-question', input);
}

// ─── L4 自然语言改参解析 ───────────────────────────────

export interface L4Input {
  request: string;
  currentConfig: {
    autoApproveIfDelayLE: { enabled: boolean; days: number };
    autoApproveTierA: boolean;
    mustHumanIfCustomerKA: boolean;
    autoApproveAmountLimit: number;
    maxFollowUpCount: number;
  };
}
export type L4Output =
  | { action: 'updateAutoApproveDelayDays'; value: number; explanation: string }
  | { action: 'toggleAutoApproveDelay'; value: boolean; explanation: string }
  | { action: 'updateMaxFollowUpCount'; value: number; explanation: string }
  | {
      action: 'reject';
      reason:
        | 'safety_path_locked'
        | 'out_of_range'
        | 'persist_requires_manual_ui'
        | 'confirm_required_via_ui'
        | 'unrecognized_intent';
      proposedAction?:
        | { action: 'toggleAutoApproveTierA'; value: boolean }
        | { action: 'toggleMustHumanIfCustomerKA'; value: boolean }
        | { action: 'updateAutoApproveAmountLimit'; value: number };
      explanation: string;
    };
export function callParseConfigIntent(input: L4Input): Promise<L4Output> {
  return callLlm<L4Input, L4Output>('parse-config-intent', input);
}
