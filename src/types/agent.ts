/**
 * Agent Console 运行时类型 —— 与 docs/agent_console_spec.md §10 + §11.1 严格对齐。
 * Trace 用 discriminated union 而不是 input/output: unknown，避免实现时拍脑袋猜字段。
 */

import type { FilterConfig, ModelId, SupplierReplyStatus } from './skill';

// ─── 剧本状态机（§11.1） ──────────────────────────────
export type ScenarioStep =
  | 'idle'
  | 'trigger'
  | 'scanning'
  | 'safety-block'
  | 'user-question'
  | 'config-adjust'
  | 'rerun'
  | 'done';

// 6 步剧本中显示给用户的"第 N 步 / 6"对应关系
export const SCENARIO_STEP_INDEX: Record<ScenarioStep, number> = {
  idle: 0,
  trigger: 1,
  scanning: 2,
  'safety-block': 3,
  'user-question': 4,
  'config-adjust': 5,
  rerun: 5,
  done: 6,
};

// 细粒度状态顺序（区分 config-adjust 和 rerun）—— 用于 ChatMessage.visibleAfter 比较
export const SCENARIO_STEP_ORDER: readonly ScenarioStep[] = [
  'idle',
  'trigger',
  'scanning',
  'safety-block',
  'user-question',
  'config-adjust',
  'rerun',
  'done',
];

// ─── 剧本级配置覆盖（mock_data_schema §5） ────────────
// 启动时计算一次，运行期间只读。剧本期间所有规则判断用
// effectiveConfig = defaultSkillConfig deep-merge scenarioConfigOverride。
// **不动 defaultSkillConfig**——让剧本场景污染 default 是平台 PM 视角的错误。
export interface ScenarioConfigOverride {
  filter: {
    supplier: {
      replyStatus: SupplierReplyStatus[];
      delayRateThreshold: number;
    };
  };
}

// ─── 单次运行级配置覆盖（D7 浮卡产物） ──────────────────
// 用户在剧本进行中通过 D7 卡片调整的临时变更，scope='thisRunOnly'。
// 仅 P1 演示业务层「延期 ≤ N 天自动同意」的 N 值调整。
export interface ThisRunConfigOverride {
  /** 业务层「延期天数 ≤ N 自动同意」的 N 值 */
  autoApproveIfDelayDays?: number;
}

// ─── 订单的运行时显示状态（不持久化） ──────────────────
// 与 mock_data_schema §4 预期状态矩阵一致：
//   idle  : 剧本启动前
//   hit   : 命中筛选规则（但未走完三层）
//   missed: 未命中（被某条规则筛掉）
//   pendingHuman: 命中 + 安全层覆盖 / 命中但无业务规则触发 → 等人工
//   autoApproved: 业务层自动同意 → 任务卡
//   humanResolved: 人工已做完决策
export type OrderRuntimeStatus =
  | 'idle'
  | 'hit'
  | 'missed'
  | 'pendingHuman'
  | 'autoApproved'
  | 'humanResolved';

export interface OrderRuntimeRow {
  orderId: string;
  status: OrderRuntimeStatus;
  /** 安全层覆盖时显示的标签文案（如 "关键件 → 必须人工"） */
  safetyTag?: string;
  /** 业务层自动同意时显示的标签文案（如 "延期 2 ≤ 阈值 2"） */
  autoApprovedReason?: string;
  /** 未命中时被哪条规则筛掉 */
  missedReason?: string;
  /** 人工决策（点击「待人工」按钮后） */
  humanDecision?: HumanDecisionKind;
}

export type HumanDecisionKind = 'dispatchToManager' | 'reassignManual' | 'skip';

// ─── Trace 日志（§10.1） ───────────────────────────────
export interface TraceBase {
  id: string; // trace-001 / trace-002 ...
  step: number; // 1-6
  timestamp: number; // ms since 剧本开始
  modelUsed?: ModelId;
  tokenUsed?: number;
  latencyMs?: number;

  /**
   * RBAC 接口预留（7-C1）——Phase 1 全部填 mock 值：
   *   actorId: 'demo-isv-banner'
   *   tenantId: 'demo-tenant-001'
   *   authorizationResult: 'granted-mock'
   */
  actorId?: string;
  tenantId?: string;
  authorizationResult?: 'granted' | 'denied' | 'granted-mock';
}

export interface IntentTrace extends TraceBase {
  type: 'intent';
  input: {
    triggerSource: 'schedule' | 'manual' | 'event' | 'nl';
    payload?: string;
  };
  output: { intent: string; confidence: number };
}

export interface FilterTrace extends TraceBase {
  type: 'filter';
  /** 必带 filter 快照，让 Debug Tab 能复现当时的筛选配置 */
  input: { orderId: string; filter: FilterConfig };
  /** failedRules 复数 —— 一条订单可能因多条规则同时不命中 */
  output: { hit: boolean; failedRules?: string[] };
}

export interface RiskTrace extends TraceBase {
  type: 'risk';
  input: { orderId: string };
  output: {
    riskLevel: 'high' | 'medium' | 'low';
    safetyBlocked: boolean;
    autoApproved: boolean;
    ruleApplied: string[];
  };
}

export interface CallSkillTrace extends TraceBase {
  type: 'call-skill';
  input: CompletenessAlertRequest;
  output: CompletenessAlertResponse | CallSkillError;
}

export interface HumanDecisionTrace extends TraceBase {
  type: 'human-decision';
  input: { orderId: string; promptedReason: string };
  output: {
    decision: HumanDecisionKind;
    clickedBy: 'user' | 'mockCursor';
  };
}

export interface ConfigChangeTrace extends TraceBase {
  type: 'config-change';
  input: { path: string; oldValue: unknown; newValue: unknown };
  output: {
    scope: 'scenario' | 'thisRunOnly' | 'persist';
    affectedOrderIds: string[];
  };
}

export type TraceLog =
  | IntentTrace
  | FilterTrace
  | RiskTrace
  | CallSkillTrace
  | HumanDecisionTrace
  | ConfigChangeTrace;

// ─── CallSkill 契约（§10.2） ───────────────────────────
export interface CompletenessAlertRequest {
  callerSkillId: 'purchaseFollowUp';
  targetOrderId: string;
  affectedWorkOrderIds: string[];
  requestedAt: number;
  timeoutMs: number;
}

export interface CompletenessAlertResponse {
  status: 'ok';
  shortageCount: number;
  affectedWorkOrderIds: string[];
  suggestion: 'humanIntervene' | 'rescheduleMRP' | 'proceedWithRisk';
  confidence: number;
}

export interface CallSkillError {
  status: 'timeout' | 'unavailable' | 'lowConfidence';
  fallback: 'humanIntervene' | 'continueWithoutChildResult';
  errorMessage: string;
}

// ─── 对话消息（§4.1） ─────────────────────────────────
export type ChatMessageKind = 'system' | 'agent' | 'user' | 'reference';

export interface ChatMessage {
  id: string;
  kind: ChatMessageKind;
  /** 系统消息携带的图标语义 */
  icon?: 'clock' | 'bolt';
  /** 实际渲染文本；流式打字效果在组件层做 */
  text: string;
  /** 关联到具体 step（用于推进时按 step 选择消息 + CoT 查找） */
  step: number;
  /**
   * 可选：精确指定"最早可见 ScenarioStep"。
   * 例：msg-010 step=5 但只在 'rerun' 之后才出现（因为 config-adjust 和 rerun 共享 step=5，
   *     不显式声明的话会在 D7 卡还开着时就提前显示"配置变更已应用"）。
   */
  visibleAfter?: ScenarioStep;
  /** 该消息是否需要打字效果（系统/用户/引用为 instant，agent 用打字） */
  streaming?: boolean;
}
