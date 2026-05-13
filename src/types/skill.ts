/**
 * Skill 配置 schema —— 与 docs/skill_builder_spec_v1.md §9 SDK 形态严格对齐。
 * 这是 Skill Builder 的"宪法"：所有 UI 模块、Code View、模拟运行都从这个 schema 派生。
 */

// PD-2：物料属性用三态选择，禁止简化为 boolean
export type Tristate = 'yes' | 'no' | 'any';

// ─── 元信息 ──────────────────────────────────────────
export type ISVRole = 'businessConsultant' | 'developer';
export type Industry =
  | '装备制造'
  | '汽车零部件'
  | '电子'
  | '半导体'
  | '通用';
export type TemplateSource = 'fromScratch' | 'officialTemplate' | 'forkFromISV';

export interface SkillMetadata {
  name: string;
  industry: Industry[];
  domainTags: string[];
  description: string;
  isvRoles: ISVRole[];
  version: string;
  templateSource: TemplateSource;
}

// ─── 触发方式 ────────────────────────────────────────
export type EventSource =
  | 'mrp.plan.changed'
  | 'workorder.inserted'
  | 'po.created'
  | 'supplier.replied';

export interface TriggerConfig {
  schedule: { enabled: boolean; cron: string };
  manual: { enabled: boolean };
  naturalLanguage: { enabled: boolean };
  event: { enabled: boolean; sources: EventSource[] };
}

// ─── 筛选规则 ────────────────────────────────────────
export type SupplierReplyStatus = 'notReplied' | 'repliedDelay' | 'repliedConfirm';
export type SupplierTier = 'A' | 'B' | 'C';
export type CustomerImportance = 'all' | 'KA' | 'strategic';

// 筛选模式：主动 = Skill 主动扫描全量订单跟催；被动 = 仅响应供应商已回复事件
export type FilterMode = 'active' | 'passive';

export interface FilterConfig {
  mode: FilterMode;
  time: {
    dueInDays: number;
    excludeCompleted: boolean;
  };
  supplier: {
    replyStatus: SupplierReplyStatus[];
    tier: SupplierTier[];
    delayRateThreshold: number; // 0-1
  };
  material: {
    isCritical: Tristate;
    isSingleSource: Tristate;
    hasAlternative: Tristate;
  };
  impact: {
    affectsWorkOrder: boolean;
    affectsMRP: boolean;
    affectsCustomerOrder: boolean;
    customerImportanceFloor: CustomerImportance;
  };
}

// ─── 动作配置 ────────────────────────────────────────
export type NotifyChannel = 'taskCard' | 'enterpriseWechat' | 'email';
export type EscalateRole =
  | 'purchase-manager'
  | 'purchase-director'
  | 'plant-manager';

// D-6：3 个可被「调用其他 Skill」选中的 mock Skill
export type CallableSkillId =
  | 'completenessAlert'
  | 'supplierRiskAssessment'
  | 'exceptionWorkOrderEscalation';

export interface ActionConfig {
  sendSupplierReminder: {
    enabled: boolean;
    channels: NotifyChannel[];
    templateId: string;
  };
  markUrgent: { enabled: boolean };
  secondaryFollowUp: { enabled: boolean; intervalHours: number };
  createExceptionTask: { enabled: boolean; escalateTo: EscalateRole };
  dispatchTaskCard: { enabled: boolean };
  callSkill: { enabled: boolean; targetSkill: CallableSkillId | null };
}

// ─── 自动化边界（PD-3 三层固定优先级） ────────────────
export interface AutomationBoundary {
  // 安全层：全部 mustHuman，UI 锁死不可关
  safety: {
    affectsWorkOrder: 'mustHuman';
    critical: 'mustHuman';
    singleSource: 'mustHuman';
    financialCompliance: 'mustHuman';
  };
  business: {
    autoApproveIfDelayLE: { enabled: boolean; days: number };
    autoApproveTierA: boolean;
    mustHumanIfCustomerKA: boolean;
  };
  efficiency: {
    maxFollowUpCount: number; // 1-5
    autoApproveAmountLimit: number; // 元
  };
}

// ─── 模型路由 ────────────────────────────────────────
export type ModelId =
  | 'deepseek-v3'
  | 'deepseek-r1'
  | 'gpt-4'
  | 'claude-sonnet'
  | 'qwen-plus'
  | 'qwen-max'
  | 'wenxin-4'
  | 'private-qwen';

export type RoutingMode =
  | 'static'
  | 'dynamic'
  | 'costFirst'
  | 'performanceFirst';

export interface ModelRouting {
  mode: RoutingMode;
  routes: {
    intentDetection: ModelId;
    slotExtraction: ModelId;
    riskAssessment: ModelId;
    anomalyDiagnosis: ModelId;
    narrativeGeneration: ModelId;
    sensitive: ModelId;
  };
}

// ─── 知识检索（RAG） ─────────────────────────────────
export type KnowledgeSource =
  | 'supplier-profile'
  | 'contract-history'
  | 'material-alternative-rules'
  | 'industry-benchmark';

export type RetrievalTrigger =
  | 'narrativeGeneration'
  | 'riskAssessment'
  | 'anomalyDiagnosis';

export type RetrievalGranularity = 'supplier' | 'material' | 'order';

export type RetrievalFallback =
  | 'useDefaultNarrative'
  | 'escalateToHuman'
  | 'skipStep';

export interface KnowledgeRetrieval {
  sources: KnowledgeSource[];
  triggerOn: RetrievalTrigger[];
  granularity: RetrievalGranularity;
  topK: number; // 1-20
  similarityThreshold: number; // 0-1
  fallbackStrategy: RetrievalFallback;
}

// ─── 顶层 SkillConfig ───────────────────────────────
export interface SkillConfig {
  metadata: SkillMetadata;
  triggers: TriggerConfig;
  filters: FilterConfig;
  actions: ActionConfig;
  automationBoundary: AutomationBoundary;
  modelRouting: ModelRouting;
  knowledgeRetrieval: KnowledgeRetrieval;
}

// ─── 冲突预警 ────────────────────────────────────────
export type ConflictSeverity = 'warning' | 'error' | 'info';

export interface Conflict {
  id: string;
  severity: ConflictSeverity;
  title: string;
  detail: string;
  /** 触发冲突的源头模块（点击冲突栏可跳过去） */
  source: keyof SkillConfig;
  /** 哪一层把它覆盖了 */
  overriddenBy?: keyof SkillConfig;
  /** 被覆盖的字段路径，用于 UI 在对应配置项上加删除线/边框 */
  overrides?: string[];
}
