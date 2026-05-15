import type { ChatMessage } from '@/types/agent';

/**
 * 复合剧本 Step 1-6 的对话脚本。
 * 文案严格对应 agent_console_spec.md §3.2-§3.7。
 */
export const CONVERSATION_SCRIPTS: ChatMessage[] = [
  // ── Step 1（trigger）：定时触发 ───────────────────────
  {
    id: 'msg-001',
    kind: 'system',
    icon: 'clock',
    text: '⏰ 08:00 定时触发',
    step: 1,
  },
  {
    id: 'msg-002',
    kind: 'reference',
    text: 'Skill：制造业采购交期跟催 v1.0.0',
    step: 1,
  },

  // ── Step 2（scanning）：扫描完成 ──────────────────────
  {
    id: 'msg-003',
    kind: 'agent',
    text: '扫描完成。10 条订单中 6 条命中跟催规则，其中 4 条高风险。',
    step: 2,
    streaming: true,
  },

  // ── Step 3（safety-block）：安全层拦截 + 调用齐套预警 ──
  {
    id: 'msg-004',
    kind: 'reference',
    text: '调用 Skill：齐套预警（completenessAlert）',
    step: 3,
  },
  {
    id: 'msg-005',
    kind: 'agent',
    text: 'PO-2025-001 是关键件且影响 2 张在制工单，触发安全层。已联动齐套预警 Skill 确认：齐套已断，缺料 2 项。建议人工立即介入。',
    step: 3,
    streaming: true,
  },

  // ── Step 4（user-question）：采购员追问 PO-005 ──────────
  {
    id: 'msg-006',
    kind: 'user',
    text: 'PO-005 怎么没自动同意？供应商都回复延期才 1 天了。',
    step: 4,
  },
  {
    id: 'msg-007',
    kind: 'agent',
    text: 'PO-2025-005 供应商已回复延期 1 天，单看延期天数原本满足业务层「延期 ≤ 2 天自动同意」（业务层延期阈值只看事实延期天数，不看供应商等级）。但物料 SMT-CTRL-V3-B11 是关键件，被安全层覆盖。规则优先级：安全 > 业务 > 效率。',
    step: 4,
    streaming: true,
  },

  // ── Step 5（config-adjust）：用户提调参意图，Agent 浮卡 ─
  {
    id: 'msg-008',
    kind: 'user',
    text: '最近天气原因供应商普遍延期，把延期容忍能从 2 天调到 3 天吗？',
    step: 5,
  },
  {
    id: 'msg-009',
    kind: 'agent',
    text: '可以。这是业务层可配置项。我帮你打开配置卡片——你可以拖动 Slider 实时预览影响范围。',
    step: 5,
    streaming: true,
  },

  // ── Step 5 ⇒ rerun：调参生效，PO-009 自动同意 ──────────
  // 必须 visibleAfter='rerun'：config-adjust 和 rerun 共享 step=5，否则会在 D7 卡还开着、
  // 用户尚未确认时就提前显示"已应用"，破坏因果叙事
  {
    id: 'msg-010',
    kind: 'agent',
    text: '配置变更已应用。PO-2025-009（延期 3 天）现在落入「业务层自动同意」范围，已自动派发任务卡。',
    step: 5,
    visibleAfter: 'rerun',
    streaming: true,
  },

  // ── Step 6（done）：剧本收尾 + 复盘提示 ────────────────
  {
    id: 'msg-011',
    kind: 'agent',
    text: '本次扫描完成：6 条命中、4 条已人工处理（安全层覆盖）、1 条业务层自动同意、1 条调参后自动同意（PO-009）。需要查看完整决策路径吗？',
    step: 6,
    streaming: true,
  },
];

export function messagesForStep(step: number): ChatMessage[] {
  return CONVERSATION_SCRIPTS.filter((m) => m.step === step);
}

export function messagesUpToStep(step: number): ChatMessage[] {
  return CONVERSATION_SCRIPTS.filter((m) => m.step <= step);
}
