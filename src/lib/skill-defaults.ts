import type { SkillConfig } from '@/types/skill';

/**
 * 开箱即用默认值 —— spec §3-§8 每个模块的默认值
 * 用作 useSkillStore 的初始 state，也用作"重置"按钮的 target。
 */
export const defaultSkillConfig: SkillConfig = {
  metadata: {
    name: '制造业采购交期跟催 Skill',
    industry: ['装备制造', '汽车零部件'],
    domainTags: ['采购协同', '供应商管理'],
    description:
      '面向装备制造行业，自动识别交期风险订单、协同供应商二次确认、按规则升级人工介入。',
    isvRoles: ['businessConsultant', 'developer'],
    version: 'v1.0.0',
    templateSource: 'officialTemplate',
  },

  triggers: {
    schedule: { enabled: true, cron: '0 8 * * *' },
    manual: { enabled: true },
    naturalLanguage: { enabled: true },
    event: {
      enabled: false,
      sources: ['mrp.plan.changed', 'workorder.inserted'],
    },
  },

  filters: {
    mode: 'active',
    time: { dueInDays: 7, excludeCompleted: true },
    supplier: {
      replyStatus: ['notReplied'],
      tier: ['A', 'B'],
      delayRateThreshold: 0.3,
    },
    material: {
      isCritical: 'any',
      isSingleSource: 'any',
      hasAlternative: 'any',
    },
    impact: {
      affectsWorkOrder: false,
      affectsMRP: false,
      affectsCustomerOrder: false,
      customerImportanceFloor: 'all',
    },
  },

  actions: {
    sendSupplierReminder: {
      enabled: true,
      channels: ['taskCard', 'enterpriseWechat'],
      templateId: 'standard-reminder-v2',
    },
    markUrgent: { enabled: false },
    secondaryFollowUp: { enabled: false, intervalHours: 24 },
    createExceptionTask: { enabled: true, escalateTo: 'purchase-manager' },
    dispatchTaskCard: { enabled: true },
    callSkill: { enabled: false, targetSkill: null },
  },

  automationBoundary: {
    safety: {
      affectsWorkOrder: 'mustHuman',
      critical: 'mustHuman',
      singleSource: 'mustHuman',
      financialCompliance: 'mustHuman',
    },
    business: {
      autoApproveIfDelayLE: { enabled: true, days: 2 },
      autoApproveTierA: false,
      mustHumanIfCustomerKA: true,
    },
    efficiency: {
      maxFollowUpCount: 3,
      autoApproveAmountLimit: 10000,
    },
  },

  modelRouting: {
    mode: 'static',
    routes: {
      intentDetection: 'deepseek-v3',
      slotExtraction: 'deepseek-v3',
      riskAssessment: 'gpt-4',
      anomalyDiagnosis: 'deepseek-r1',
      narrativeGeneration: 'qwen-max',
      sensitive: 'private-qwen',
    },
  },

  knowledgeRetrieval: {
    sources: ['supplier-profile', 'contract-history'],
    triggerOn: ['narrativeGeneration', 'riskAssessment'],
    granularity: 'material',
    topK: 5,
    similarityThreshold: 0.7,
    fallbackStrategy: 'useDefaultNarrative',
  },
};
