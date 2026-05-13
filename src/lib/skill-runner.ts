import type { DemoScenario, PurchaseOrder } from '@/types/mock-data';
import type { SkillConfig } from '@/types/skill';

/**
 * 模拟运行引擎 —— 输入 (Skill 配置, 场景)，输出运行结果。
 *
 * 严格按 PD-3 三层固定优先级（安全 > 业务 > 效率）评估每条订单：
 *   1. 走 filters 决定是否命中本 Skill
 *   2. 命中的订单逐条评估 automationBoundary
 *      - 触发任一安全层规则 → mustHuman（安全层覆盖一切）
 *      - 满足业务层自动同意条件 → autoApprove
 *      - 否则 → manualReview
 *   3. 派发 actions：通知 / 任务卡 / 异常任务 / 调用其他 Skill
 *
 * 这是 Demo 引擎，不连真实数据库或 LLM。
 */

interface ClassifiedOrder {
  order: PurchaseOrder;
  reasons: string[];
}

export interface RunResult {
  scenario: DemoScenario;
  totalOrders: number;
  filtered: PurchaseOrder[];
  filteredOut: { order: PurchaseOrder; reason: string }[];
  safetyOverride: ClassifiedOrder[];
  businessAutoApprove: ClassifiedOrder[];
  manualReview: ClassifiedOrder[];
  actions: { kind: string; count: number; detail?: string }[];
  callSkill: { name: string; reason: string } | null;
}

const CALL_SKILL_LABEL: Record<string, string> = {
  completenessAlert: '齐套预警 Skill',
  supplierRiskAssessment: '供应商风险评估 Skill',
  exceptionWorkOrderEscalation: '异常工单升级 Skill',
};

export function runSkill(
  config: SkillConfig,
  scenario: DemoScenario,
): RunResult {
  const filtered: PurchaseOrder[] = [];
  const filteredOut: { order: PurchaseOrder; reason: string }[] = [];

  // ── 步骤 1：筛选 ───────────────────────────────
  for (const order of scenario.orders) {
    const reason = filterReason(order, config);
    if (reason === null) filtered.push(order);
    else filteredOut.push({ order, reason });
  }

  // ── 步骤 2：三层判定 ───────────────────────────
  const safetyOverride: ClassifiedOrder[] = [];
  const businessAutoApprove: ClassifiedOrder[] = [];
  const manualReview: ClassifiedOrder[] = [];

  for (const order of filtered) {
    const safety = safetyTriggers(order, config);
    if (safety.length > 0) {
      safetyOverride.push({ order, reasons: safety });
      continue;
    }
    const business = businessAutoTriggers(order, config);
    if (business.length > 0) {
      businessAutoApprove.push({ order, reasons: business });
      continue;
    }
    manualReview.push({ order, reasons: ['需采购员介入判断'] });
  }

  // ── 步骤 3：动作派发 ───────────────────────────
  const actions: { kind: string; count: number; detail?: string }[] = [];

  if (config.actions.sendSupplierReminder.enabled) {
    const targets = filtered.filter(
      (o) => o.supplierReplyStatus === 'notReplied',
    ).length;
    actions.push({
      kind: '发送供应商跟催',
      count: targets,
      detail: config.actions.sendSupplierReminder.channels
        .map(channelLabel)
        .join(' + '),
    });
  }

  if (config.actions.dispatchTaskCard.enabled) {
    const count = manualReview.length + safetyOverride.length;
    if (count > 0) {
      actions.push({
        kind: '派发任务卡',
        count,
        detail: '推送给采购员处理',
      });
    }
  }

  if (
    config.actions.createExceptionTask.enabled &&
    safetyOverride.length > 0
  ) {
    actions.push({
      kind: '创建异常任务',
      count: safetyOverride.length,
      detail: `升级到${escalateLabel(
        config.actions.createExceptionTask.escalateTo,
      )}`,
    });
  }

  if (config.actions.markUrgent.enabled && safetyOverride.length > 0) {
    actions.push({
      kind: '标记加急',
      count: safetyOverride.length,
    });
  }

  if (
    config.actions.secondaryFollowUp.enabled &&
    manualReview.length > 0
  ) {
    actions.push({
      kind: '发起二次跟催',
      count: manualReview.length,
      detail: `间隔 ${config.actions.secondaryFollowUp.intervalHours} 小时`,
    });
  }

  // ── 步骤 4：调用其他 Skill ────────────────────
  let callSkill: RunResult['callSkill'] = null;
  if (
    config.actions.callSkill.enabled &&
    config.actions.callSkill.targetSkill
  ) {
    const target = config.actions.callSkill.targetSkill;
    const reason =
      filtered.some((o) => o.affectedWorkOrderIds.length > 0) ||
      safetyOverride.length > 0
        ? '命中订单影响在制工单 / 触发安全层 → 联动协同 Skill'
        : '当前场景未达到协同触发条件（演示中仍会调用）';
    callSkill = {
      name: CALL_SKILL_LABEL[target] ?? target,
      reason,
    };
  }

  return {
    scenario,
    totalOrders: scenario.orders.length,
    filtered,
    filteredOut,
    safetyOverride,
    businessAutoApprove,
    manualReview,
    actions,
    callSkill,
  };
}

// ── 筛选规则 ─────────────────────────────────────

function filterReason(
  order: PurchaseOrder,
  config: SkillConfig,
): string | null {
  const f = config.filters;

  if (f.time.excludeCompleted && order.completed) {
    return '已完结订单';
  }
  if (order.dueInDays > f.time.dueInDays) {
    return `到货距今 ${order.dueInDays} 天，超出「${f.time.dueInDays} 天」时间窗`;
  }
  if (!f.supplier.replyStatus.includes(order.supplierReplyStatus)) {
    return `回复状态 ${order.supplierReplyStatus} 不在筛选范围`;
  }
  if (!f.supplier.tier.includes(order.supplierTier)) {
    return `供应商 ${order.supplierTier} 级不在筛选范围`;
  }
  if (
    f.mode === 'active' &&
    order.supplierDelayRate < f.supplier.delayRateThreshold
  ) {
    return `历史延期率 ${(order.supplierDelayRate * 100).toFixed(0)}% 低于阈值`;
  }
  if (f.material.isCritical !== 'any' && f.material.isCritical !== order.isCritical) {
    return '物料属性「是否关键件」不匹配';
  }
  if (
    f.material.isSingleSource !== 'any' &&
    f.material.isSingleSource !== order.isSingleSource
  ) {
    return '物料属性「是否单一来源」不匹配';
  }
  if (
    f.material.hasAlternative !== 'any' &&
    f.material.hasAlternative !== order.hasAlternative
  ) {
    return '物料属性「是否有替代料」不匹配';
  }
  if (
    f.impact.affectsWorkOrder &&
    order.affectedWorkOrderIds.length === 0
  ) {
    return '已勾选「影响在制工单」但本订单未关联';
  }
  if (f.impact.affectsMRP && !order.affectsMRP) {
    return '已勾选「影响 MRP」但本订单未关联';
  }
  if (
    f.impact.affectsCustomerOrder &&
    order.affectedCustomerOrderIds.length === 0
  ) {
    return '已勾选「影响客户订单」但本订单未关联';
  }
  return null;
}

// ── 安全层触发 ───────────────────────────────────

function safetyTriggers(
  order: PurchaseOrder,
  config: SkillConfig,
): string[] {
  const reasons: string[] = [];
  // 安全层硬规则恒开（与 schema 锁定一致）
  if (order.affectedWorkOrderIds.length > 0) {
    reasons.push(
      `影响在制工单 ${order.affectedWorkOrderIds.join('、')} → 必须人工`,
    );
  }
  if (order.isCritical === 'yes') {
    reasons.push('关键件 → 必须人工');
  }
  if (order.isSingleSource === 'yes') {
    reasons.push('单一来源 → 必须人工');
  }
  // 财务合规事项无 mock 字段，省略
  // 业务层独立的 KA 规则也在这里参与安全 / 业务判定，但 KA 是业务层不是安全层
  const business = config.automationBoundary.business;
  if (
    business.mustHumanIfCustomerKA &&
    config.filters.impact.affectsCustomerOrder &&
    (order.customerImportance === 'KA' ||
      order.customerImportance === 'strategic')
  ) {
    reasons.push(`${order.customerImportance} 客户订单 → 业务层强制人工`);
  }
  return reasons;
}

// ── 业务层自动同意触发 ───────────────────────────

function businessAutoTriggers(
  order: PurchaseOrder,
  config: SkillConfig,
): string[] {
  const reasons: string[] = [];
  const business = config.automationBoundary.business;
  const efficiency = config.automationBoundary.efficiency;

  // 效率层金额上限是兜底约束 —— 超额必须人工
  if (order.amount > efficiency.autoApproveAmountLimit) {
    return [];
  }

  if (
    business.autoApproveIfDelayLE.enabled &&
    order.supplierReplyStatus === 'repliedDelay' &&
    (order.supplierDelayReply ?? 0) <= business.autoApproveIfDelayLE.days
  ) {
    reasons.push(
      `回复延期 ${order.supplierDelayReply} 天 ≤ ${business.autoApproveIfDelayLE.days} 天阈值`,
    );
  }
  if (business.autoApproveTierA && order.supplierTier === 'A') {
    reasons.push('A 级供应商');
  }
  return reasons;
}

// ── 文案辅助 ─────────────────────────────────────

function channelLabel(c: string): string {
  switch (c) {
    case 'taskCard':
      return '任务卡';
    case 'enterpriseWechat':
      return '企业微信';
    case 'email':
      return '邮件';
    default:
      return c;
  }
}

function escalateLabel(r: string): string {
  switch (r) {
    case 'purchase-manager':
      return '采购主管';
    case 'purchase-director':
      return '采购总监';
    case 'plant-manager':
      return '厂长';
    default:
      return r;
  }
}
