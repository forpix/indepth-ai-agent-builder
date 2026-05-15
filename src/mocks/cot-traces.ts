import type { CompletenessAlertResponse } from '@/types/agent';

/**
 * 思考链（CoT）mock 文本 —— 按 step 编号检索。
 * agent_console_spec.md §4.2 的 D2 炫点（P1 在 Agent 气泡末尾「展开思考链」时使用）。
 * P0 阶段只准备数据，UI 在 P1 接。
 */
export const COT_TRACES: Record<number, string[]> = {
  2: [
    '1. 识别触发源 = schedule（cron: 0 8 * * *）',
    '2. 加载 effective config（merge scenarioConfigOverride）',
    '3. 全量扫描 10 条订单，逐条应用筛选规则',
    '4. 命中 6/10，未命中 4/10',
  ],
  3: [
    '1. 检测关键件 = yes → 安全层硬规则触发',
    '2. 检测影响在制工单 = 2 张 → 需要齐套影响评估',
    '3. 调用关联 Skill: completenessAlert（齐套预警）',
    '4. 子 Skill 返回缺料数 = 2，置信度 0.91',
    '5. 综合判断: 必须人工，建议优先级 P0',
  ],
  4: [
    '1. 用户意图识别：追问规则优先级合理性',
    '2. 加载 PO-2025-005 的事实层：isCritical=yes, supplierDelayReply=1',
    '3. 业务层规则 autoApproveIfDelayLE.days=2 检查：1 ≤ 2 ✓（会触发）',
    '4. 安全层规则 safety.critical=mustHuman 检查：isCritical=yes（触发）',
    '5. PD-3 三层固定优先级：安全 > 业务 → 安全层覆盖业务层',
    '6. 输出：解释规则优先级 + 标注业务层规则被覆盖',
  ],
  5: [
    '1. 用户意图识别：临时调参（业务层延期阈值）',
    '2. 定位可配置项：automationBoundary.business.autoApproveIfDelayLE.days',
    '3. 浮起迷你 Skill Builder 卡，预填当前值 = 2',
    '4. 实时预览：阈值 → 3 时，PO-009（延期 3 天）将被纳入自动同意',
    '5. 用户确认 → 写 ConfigChangeTrace(scope=thisRunOnly)',
    '6. 重跑分类，PO-009 状态 pendingHuman → autoApproved',
  ],
};

/**
 * 子 Skill「齐套预警」剧本固定 mock 响应。
 * agent_console_spec.md §10.2 锁定的契约，剧本演示时 Step 3 写入 CallSkillTrace。
 */
export const MOCK_COMPLETENESS_ALERT_RESPONSE: CompletenessAlertResponse = {
  status: 'ok',
  shortageCount: 2,
  affectedWorkOrderIds: ['WO-2025-0312', 'WO-2025-0315'],
  suggestion: 'humanIntervene',
  confidence: 0.91,
};

/**
 * Memory 摘要 mock —— agent_console_spec.md §6.5 固定 3 条。
 * 用于决策面板"过往 N 条相关决策"演示。
 */
export const MOCK_MEMORY_ENTRIES = [
  {
    date: '5 月 8 日',
    order: 'PO-014',
    summary: '关键件订单',
    decision: '人工立即介入',
  },
  {
    date: '5 月 6 日',
    order: 'PO-009',
    summary: '单一来源订单',
    decision: '升级到采购主管',
  },
  {
    date: '5 月 4 日',
    order: 'PO-002',
    summary: 'KA 客户订单',
    decision: '人工 + 通知销售',
  },
] as const;
