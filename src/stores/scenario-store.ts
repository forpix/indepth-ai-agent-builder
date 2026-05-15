import { create } from 'zustand';

import { MOCK_COMPLETENESS_ALERT_RESPONSE } from '@/mocks/cot-traces';
import { MOCK_PURCHASE_ORDERS } from '@/mocks/purchase-orders';
import { defaultSkillConfig } from '@/lib/skill-defaults';
import {
  callAnswerQuestion,
  callOrchestrate,
  callParseConfigIntent,
  callRiskJudge,
  LlmFetchError,
} from '@/lib/llm-client';
import { runSkill } from '@/lib/skill-runner';
import { isRealLlmEnabled } from '@/hooks/use-real-llm';
import { useSkillStore } from '@/stores/skill-store';
import type {
  CompletenessAlertRequest,
  HumanDecisionKind,
  OrderRuntimeRow,
  OrderRuntimeStatus,
  ScenarioConfigOverride,
  ScenarioStep,
  ThisRunConfigOverride,
  TraceLog,
} from '@/types/agent';
import type { DemoScenario, PurchaseOrder } from '@/types/mock-data';
import type { SkillConfig } from '@/types/skill';

/**
 * Agent Console 复合剧本运行时状态机 + scenarioConfigOverride 覆盖层。
 *
 * 关键约束（docs/mock_data_schema.md §5 + agent_console_spec.md §11.1）：
 *   1. **绝不动 defaultSkillConfig**——让剧本污染 default 是平台 PM 视角的错误
 *   2. 剧本启动时 scenarioConfigOverride 由本 store 计算一次，期间只读
 *   3. 所有规则判断用 effectiveConfig = deepMerge(default, scenarioOv, thisRunOv)
 *   4. 每个状态转移都写对应的 Trace，便于 Phase 3 Debug Tab 复现
 *
 * P0 路径：idle → trigger → scanning → safety-block → done
 * P1 扩展：safety-block → user-question → config-adjust → rerun → done
 */

const RBAC_MOCK = {
  actorId: 'demo-isv-banner',
  tenantId: 'demo-tenant-001',
  authorizationResult: 'granted-mock' as const,
};

// 剧本固定的两处覆盖（mock_data_schema §5.1 锁定）
const SCENARIO_CONFIG_OVERRIDE: ScenarioConfigOverride = {
  filter: {
    supplier: {
      replyStatus: ['notReplied', 'repliedDelay'],
      delayRateThreshold: 0,
    },
  },
};

const MOCK_ORDERS_ARRAY: PurchaseOrder[] = Object.values(MOCK_PURCHASE_ORDERS);

/** 计算 effective config = default ⊕ scenarioOv ⊕ thisRunOv。 */
function computeEffectiveConfig(
  base: SkillConfig,
  scenarioOv: ScenarioConfigOverride,
  thisRunOv: ThisRunConfigOverride,
): SkillConfig {
  let cfg: SkillConfig = {
    ...base,
    filters: {
      ...base.filters,
      supplier: {
        ...base.filters.supplier,
        replyStatus: scenarioOv.filter.supplier.replyStatus,
        delayRateThreshold: scenarioOv.filter.supplier.delayRateThreshold,
      },
    },
  };
  if (thisRunOv.autoApproveIfDelayDays !== undefined) {
    cfg = {
      ...cfg,
      automationBoundary: {
        ...cfg.automationBoundary,
        business: {
          ...cfg.automationBoundary.business,
          autoApproveIfDelayLE: {
            ...cfg.automationBoundary.business.autoApproveIfDelayLE,
            days: thisRunOv.autoApproveIfDelayDays,
          },
        },
      },
    };
  }
  return cfg;
}

function buildInternalScenario(): DemoScenario {
  return {
    id: 'A',
    title: 'Agent Console 复合剧本',
    narrative: '8 点定时触发 → 扫描 10 条订单 → 安全层拦截 + 多智能体协同',
    orders: MOCK_ORDERS_ARRAY,
  };
}

function initRuntimeRows(): Record<string, OrderRuntimeRow> {
  const map: Record<string, OrderRuntimeRow> = {};
  for (const order of MOCK_ORDERS_ARRAY) {
    map[order.id] = { orderId: order.id, status: 'idle' };
  }
  return map;
}

function makeTraceId(traces: TraceLog[]): string {
  const next = traces.length + 1;
  return `trace-${String(next).padStart(3, '0')}`;
}

interface MockCursor {
  x: number;
  y: number;
  /** 当前播报阶段，UI 可基于此显示提示气泡 */
  hint?: string;
}

interface ScenarioState {
  currentStep: ScenarioStep;
  startedAt: number | null;
  scenarioConfigOverride: ScenarioConfigOverride;
  thisRunConfigOverride: ThisRunConfigOverride;
  runtimeRows: Record<string, OrderRuntimeRow>;
  traces: TraceLog[];
  toast: string | null;
  cotExpandedStep: number | null;

  // P1 新增
  /** D7 浮起迷你 Skill Builder 卡是否打开 */
  showD7Card: boolean;
  /** X1 演示模式开关 */
  isAutoPlaying: boolean;
  /** 伪鼠标位置（fixed 定位，px 单位）。null = 不显示 */
  mockCursor: MockCursor | null;
  /** X4 一键复盘 Modal 是否打开 */
  showReviewModal: boolean;
  /** 内部用：autoPlay 调度的 setTimeout id 列表，reset 时清空 */
  playbackTimers: number[];

  // Phase 3 / Debug & Eval Tab 新增
  /** 当前选中的 trace id（左栏 → 中栏联动）。X4 跳转过来时初始化为 'trace-001' */
  selectedTraceId: string | null;
  /** P1 跨 Tab 高亮：DE → AC 跳转时设置目标订单 ID，AC 订单表加 ring + scrollIntoView，3 秒后自动清空 */
  highlightedOrderId: string | null;

  // Phase G / 真 LLM 接入新增（demo_scripts §2）
  /** real 模式下 LLM 生成的内容覆盖（UI 渲染时优先用 replacement） */
  llmReplacements: {
    /** L1: Step 3 风险综合 CoT（替换 cot-traces 的 mock） */
    riskCot?: string[];
    /** L2: Step 3 子 Skill 编排决策（仅 Debug Tab 显示） */
    orchestrateReasoning?: string;
    /** L3: Step 4 PO-005 解释文本（替换 conversation-scripts msg-007） */
    answerExplanation?: { text: string; citedRules: string[] };
    /** L4: Step 5 自然语言解析出的 action（autoplay 路径仅作 trace 标记，demo 节奏不依赖） */
    parsedConfig?: {
      action: string;
      value?: number | boolean;
      reason?: string;
      explanation: string;
    };
    /**
     * L3 已尝试且失败/超时（前端用于终结"waitingForL3"等待态，msg-007 回退到 mock）。
     * 不靠 `answerExplanation === undefined` 区分"未调用"和"调用失败"。
     */
    l3FellBack?: boolean;
  };
  /** real 模式上次 LLM 失败原因（toast 提示用，1.8s 自动清空） */
  llmLastError: string | null;

  // Actions
  start: () => void;
  next: () => void;
  submitHumanDecision: (
    orderId: string,
    decision: HumanDecisionKind,
    clickedBy?: 'user' | 'mockCursor',
  ) => void;
  reset: () => void;
  dismissToast: () => void;
  toggleCot: (step: number) => void;

  // P1 新增 actions
  openD7Card: () => void;
  closeD7Card: () => void;
  applyThisRunOverride: (
    newDays: number,
    persist: boolean,
  ) => void;
  startAutoPlay: () => void;
  cancelAutoPlay: () => void;
  setMockCursor: (cursor: MockCursor | null) => void;
  openReviewModal: () => void;
  closeReviewModal: () => void;

  // Phase 3 actions
  setSelectedTrace: (traceId: string | null) => void;
  setHighlightedOrder: (orderId: string | null) => void;

  // Phase G actions
  applyLlmReplacement: (patch: Partial<ScenarioState['llmReplacements']>) => void;
  setLlmError: (msg: string | null) => void;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  currentStep: 'idle',
  startedAt: null,
  scenarioConfigOverride: SCENARIO_CONFIG_OVERRIDE,
  thisRunConfigOverride: {},
  runtimeRows: initRuntimeRows(),
  traces: [],
  toast: null,
  cotExpandedStep: null,

  showD7Card: false,
  isAutoPlaying: false,
  mockCursor: null,
  showReviewModal: false,
  playbackTimers: [],

  selectedTraceId: null,
  highlightedOrderId: null,

  llmReplacements: {},
  llmLastError: null,

  start: () => {
    const startedAt = Date.now();
    const traces: TraceLog[] = [];

    traces.push({
      ...RBAC_MOCK,
      id: makeTraceId(traces),
      type: 'intent',
      step: 1,
      timestamp: 0,
      modelUsed: 'deepseek-v3',
      tokenUsed: 32,
      latencyMs: 180,
      input: { triggerSource: 'schedule', payload: 'cron: 0 8 * * *' },
      output: { intent: '全量扫描跟催场景', confidence: 0.97 },
    });

    traces.push({
      ...RBAC_MOCK,
      id: makeTraceId(traces),
      type: 'config-change',
      step: 1,
      timestamp: 50,
      input: {
        path: 'filter.supplier',
        oldValue: {
          replyStatus: defaultSkillConfig.filters.supplier.replyStatus,
          delayRateThreshold:
            defaultSkillConfig.filters.supplier.delayRateThreshold,
        },
        newValue: SCENARIO_CONFIG_OVERRIDE.filter.supplier,
      },
      output: {
        scope: 'scenario',
        affectedOrderIds: ['PO-2025-004', 'PO-2025-005', 'PO-2025-009'],
      },
    });

    set({
      currentStep: 'trigger',
      startedAt,
      thisRunConfigOverride: {},
      runtimeRows: initRuntimeRows(),
      traces,
      toast: null,
      showD7Card: false,
      showReviewModal: false,
    });
  },

  next: () => {
    const { currentStep } = get();

    switch (currentStep) {
      case 'trigger':
        transitionToScanning();
        return;
      case 'scanning':
        transitionToSafetyBlock();
        return;
      case 'safety-block': {
        // Step 4 进入：写 IntentTrace 记录用户的自然语言追问（"PO-005 怎么没自动同意？"）
        // —— 让 Debug Tab Step 4 不再空白，且能在 trace 里看到 NL → 意图分类的中间产物
        const { traces, startedAt } = get();
        const newTraces: TraceLog[] = [
          ...traces,
          {
            ...RBAC_MOCK,
            id: makeTraceId(traces),
            type: 'intent',
            step: 4,
            timestamp: startedAt ? Date.now() - startedAt : 0,
            modelUsed: 'deepseek-v3',
            tokenUsed: 84,
            latencyMs: 320,
            input: {
              triggerSource: 'nl',
              payload: 'PO-005 怎么没自动同意？供应商都回复延期才 1 天了。',
            },
            output: {
              intent: 'explainRulePriority(target=PO-2025-005)',
              confidence: 0.93,
            },
          },
        ];
        set({ currentStep: 'user-question', traces: newTraces });
        // L3：fire 真 LLM 解释 PO-005 追问（异步，trace 上面已经写过用户意图）
        fireL3AnswerQuestion();
        return;
      }
      case 'user-question':
        set({ currentStep: 'config-adjust' });
        // L4：进入 Step 5 时 fire 真 LLM 解析"调到 3 天"意图
        fireL4ParseConfigIntent();
        // D7 卡延迟 ~2.2s 浮起 —— 给 msg-009「我帮你打开配置卡片」时间 streaming
        // 完成，让"Agent 先说话再开卡"的因果顺序清晰
        {
          const t = window.setTimeout(() => {
            if (useScenarioStore.getState().currentStep === 'config-adjust') {
              useScenarioStore.setState({ showD7Card: true });
            }
          }, 2200);
          set((s) => ({ playbackTimers: [...s.playbackTimers, t] }));
        }
        return;
      case 'config-adjust':
        // 跳过 D7（用户选择不调参） → 直接 rerun（不应用任何 override）
        set({ currentStep: 'rerun', showD7Card: false });
        return;
      case 'rerun':
        set({ currentStep: 'done' });
        return;
      default:
        return;
    }
  },

  submitHumanDecision: (orderId, decision, clickedBy = 'user') => {
    const { runtimeRows, traces, startedAt } = get();
    const row = runtimeRows[orderId];
    if (!row || row.status !== 'pendingHuman') return;

    const updatedRows: Record<string, OrderRuntimeRow> = {
      ...runtimeRows,
      [orderId]: {
        ...row,
        status: 'humanResolved',
        humanDecision: decision,
      },
    };

    const updatedTraces: TraceLog[] = [
      ...traces,
      {
        ...RBAC_MOCK,
        id: makeTraceId(traces),
        type: 'human-decision',
        step: 3,
        timestamp: startedAt ? Date.now() - startedAt : 0,
        input: {
          orderId,
          promptedReason: row.safetyTag ?? '命中订单需采购员介入',
        },
        output: { decision, clickedBy },
      },
    ];

    set({
      runtimeRows: updatedRows,
      traces: updatedTraces,
      toast: '决策已记入 Memory',
    });
  },

  reset: () => {
    // 清空 autoPlay 计时器
    const { playbackTimers } = get();
    for (const t of playbackTimers) window.clearTimeout(t);
    set({
      currentStep: 'idle',
      startedAt: null,
      thisRunConfigOverride: {},
      runtimeRows: initRuntimeRows(),
      traces: [],
      toast: null,
      cotExpandedStep: null,
      showD7Card: false,
      isAutoPlaying: false,
      mockCursor: null,
      showReviewModal: false,
      playbackTimers: [],
      selectedTraceId: null,
      highlightedOrderId: null,
      llmReplacements: {},
      llmLastError: null,
    });
  },

  dismissToast: () => set({ toast: null }),

  toggleCot: (step) =>
    set(({ cotExpandedStep }) => ({
      cotExpandedStep: cotExpandedStep === step ? null : step,
    })),

  openD7Card: () => set({ showD7Card: true }),
  closeD7Card: () => set({ showD7Card: false }),

  applyThisRunOverride: (newDays, persist) => {
    const {
      currentStep,
      thisRunConfigOverride,
      traces,
      startedAt,
      runtimeRows,
      scenarioConfigOverride,
    } = get();

    // Guard（Codex review #1）：安全层评估必须先发生
    // 否则会绕过 RiskTrace / CallSkillTrace → trace 不完整违反 PD-7
    const allowedSteps: ScenarioStep[] = [
      'safety-block',
      'user-question',
      'config-adjust',
    ];
    if (!allowedSteps.includes(currentStep)) {
      set({
        toast: '需先完成安全层评估（Step 3）才能调参',
        showD7Card: false,
      });
      return;
    }

    const oldDays =
      thisRunConfigOverride.autoApproveIfDelayDays ??
      useSkillStore.getState().config.automationBoundary.business
        .autoApproveIfDelayLE.days;

    const newOverride: ThisRunConfigOverride = {
      ...thisRunConfigOverride,
      autoApproveIfDelayDays: newDays,
    };

    // ⭐ 修复 #2（Codex review）：persist=true 时真实写回 useSkillStore
    // 不仅写 trace，让 Skill Builder Tab 切过去也能看到新配置 —— 跨 Tab 状态闭环
    // demo 全部当 ISV/admin（spec §7.3 RBAC 接口预留：authorizationResult='granted-mock'）
    if (persist) {
      useSkillStore.getState().setConfig((draft) => {
        draft.automationBoundary.business.autoApproveIfDelayLE.days = newDays;
      });
    }

    // 计算 effective config 用于重新分类
    // persist 后 default 已更新；thisRunOv 同步设值（即使 default 变了，留着也无害）
    const effectiveBaseConfig = persist
      ? useSkillStore.getState().config
      : defaultSkillConfig;
    const effectiveConfig = computeEffectiveConfig(
      effectiveBaseConfig,
      scenarioConfigOverride,
      newOverride,
    );
    const result = runSkill(effectiveConfig, buildInternalScenario());

    // 重新分类，但保留 humanResolved（用户已决策的不再回滚）
    const updatedRows: Record<string, OrderRuntimeRow> = { ...runtimeRows };

    for (const order of MOCK_ORDERS_ARRAY) {
      const existing = updatedRows[order.id];
      if (!existing || existing.status === 'humanResolved') continue;

      const inSafety = result.safetyOverride.find(({ order: o }) => o.id === order.id);
      const inAuto = result.businessAutoApprove.find(
        ({ order: o }) => o.id === order.id,
      );
      const inManual = result.manualReview.find(
        ({ order: o }) => o.id === order.id,
      );
      const missed = !inSafety && !inAuto && !inManual;

      if (inSafety) {
        updatedRows[order.id] = {
          ...existing,
          status: 'pendingHuman',
          safetyTag: inSafety.reasons[0] ?? '安全层覆盖',
        };
      } else if (inAuto) {
        updatedRows[order.id] = {
          ...existing,
          status: 'autoApproved',
          autoApprovedReason: inAuto.reasons[0] ?? '业务层自动同意',
          safetyTag: undefined,
        };
      } else if (inManual) {
        updatedRows[order.id] = {
          ...existing,
          status: 'pendingHuman',
          safetyTag: '命中但无业务规则触发 → 待人工',
        };
      } else if (missed) {
        // 未命中保留原状
      }
    }

    // 计算受影响的订单（status 从 pendingHuman 翻到 autoApproved）
    const affectedOrderIds: string[] = [];
    for (const order of MOCK_ORDERS_ARRAY) {
      const before = runtimeRows[order.id];
      const after = updatedRows[order.id];
      if (
        before?.status === 'pendingHuman' &&
        after?.status === 'autoApproved'
      ) {
        affectedOrderIds.push(order.id);
      }
    }

    // 写 ConfigChangeTrace
    const newTraces: TraceLog[] = [
      ...traces,
      {
        ...RBAC_MOCK,
        id: makeTraceId(traces),
        type: 'config-change',
        step: 5,
        timestamp: startedAt ? Date.now() - startedAt : 0,
        input: {
          path: 'automationBoundary.business.autoApproveIfDelayLE.days',
          oldValue: oldDays,
          newValue: newDays,
        },
        output: {
          scope: persist ? 'persist' : 'thisRunOnly',
          affectedOrderIds,
        },
      },
    ];

    set({
      thisRunConfigOverride: newOverride,
      runtimeRows: updatedRows,
      traces: newTraces,
      showD7Card: false,
      currentStep: 'rerun',
      toast: affectedOrderIds.length > 0
        ? `配置变更已应用 / ${affectedOrderIds.join('、')} 已自动派发任务卡`
        : '配置变更已应用',
    });
  },

  startAutoPlay: () => {
    get().cancelAutoPlay();
    get().reset();

    set({ isAutoPlaying: true });
    const timers: number[] = [];
    const schedule = (delay: number, fn: () => void) => {
      const id = window.setTimeout(fn, delay);
      timers.push(id);
    };

    // 自动播放剧本时间表（总长约 75-90s，可按需调整）
    // Step 1 (start) 已在上面调用 reset 后，下面 0.5s 进 start
    schedule(300, () => useScenarioStore.getState().start());

    // Step 1 → 2 scanning
    schedule(3500, () => useScenarioStore.getState().next());

    // Step 2 → 3 safety-block
    schedule(11000, () => useScenarioStore.getState().next());

    // Step 3 内部：4 条人工决策（带伪光标）
    const decisions: { id: string; delay: number }[] = [
      { id: 'PO-2025-001', delay: 16000 },
      { id: 'PO-2025-002', delay: 19500 },
      { id: 'PO-2025-005', delay: 23000 },
      { id: 'PO-2025-007', delay: 26500 },
    ];
    for (const { id, delay } of decisions) {
      schedule(delay, () => mockCursorClickWaitingButton(id));
    }

    // Step 3 → 4 user-question
    schedule(31000, () => {
      useScenarioStore.setState({ mockCursor: null });
      useScenarioStore.getState().next();
    });

    // Step 4 → 5 config-adjust + D7 卡浮起
    schedule(40000, () => useScenarioStore.getState().next());

    // Step 5 内部：D7 卡 slider 移动 + 确认（用 applyThisRunOverride 直接应用）
    schedule(46000, () => useScenarioStore.getState().applyThisRunOverride(3, false));

    // Step 5 → 6 done
    // 用显式 setState 而不是 next()：next() 内部 switch 依赖 currentStep，若中途状态被
    // 任何路径搅动（如 next() 被提前手动调过），rerun→done 这步可能被跳过/绕过
    schedule(50000, () =>
      useScenarioStore.setState((s) =>
        s.currentStep === 'idle' ? {} : { currentStep: 'done' as const },
      ),
    );

    // Step 6 高亮 一键复盘按钮 + 兜底再 force 一次 done（防 t=50s 因任何原因没生效）
    schedule(52000, () =>
      useScenarioStore.setState((s) => ({
        isAutoPlaying: false,
        currentStep:
          s.currentStep === 'idle' ? s.currentStep : ('done' as const),
      })),
    );

    set({ playbackTimers: timers });
  },

  cancelAutoPlay: () => {
    const { playbackTimers } = get();
    for (const t of playbackTimers) window.clearTimeout(t);
    set({ playbackTimers: [], isAutoPlaying: false, mockCursor: null });
  },

  setMockCursor: (cursor) => set({ mockCursor: cursor }),

  openReviewModal: () => set({ showReviewModal: true }),
  closeReviewModal: () => set({ showReviewModal: false }),

  setSelectedTrace: (traceId) => set({ selectedTraceId: traceId }),
  setHighlightedOrder: (orderId) => set({ highlightedOrderId: orderId }),

  applyLlmReplacement: (patch) =>
    set((state) => ({
      llmReplacements: { ...state.llmReplacements, ...patch },
    })),
  setLlmError: (msg) => set({ llmLastError: msg }),
}));

// ─── 状态转移 helpers ─────────────────────────────────

function transitionToScanning() {
  const { traces, scenarioConfigOverride, thisRunConfigOverride } =
    useScenarioStore.getState();
  const effectiveConfig = computeEffectiveConfig(
    defaultSkillConfig,
    scenarioConfigOverride,
    thisRunConfigOverride,
  );
  const result = runSkill(effectiveConfig, buildInternalScenario());

  const hitIds = new Set(result.filtered.map((o) => o.id));
  const missedByReason = new Map<string, string>();
  for (const { order, reason } of result.filteredOut) {
    missedByReason.set(order.id, reason);
  }

  const updatedRows: Record<string, OrderRuntimeRow> = {};
  for (const order of MOCK_ORDERS_ARRAY) {
    const id = order.id;
    if (hitIds.has(id)) {
      updatedRows[id] = { orderId: id, status: 'hit' };
    } else {
      updatedRows[id] = {
        orderId: id,
        status: 'missed',
        missedReason: missedByReason.get(id) ?? '未命中',
      };
    }
  }

  const newTraces: TraceLog[] = [...traces];
  let cumulativeT = 250;
  for (const order of MOCK_ORDERS_ARRAY) {
    cumulativeT += 24;
    const hit = hitIds.has(order.id);
    newTraces.push({
      ...RBAC_MOCK,
      id: makeTraceId(newTraces),
      type: 'filter',
      step: 2,
      timestamp: cumulativeT,
      modelUsed: 'deepseek-v3',
      tokenUsed: 18,
      latencyMs: 22,
      input: { orderId: order.id, filter: effectiveConfig.filters },
      output: hit
        ? { hit: true }
        : {
            hit: false,
            failedRules: [missedByReason.get(order.id) ?? '未命中'],
          },
    });
  }

  useScenarioStore.setState({
    currentStep: 'scanning',
    runtimeRows: updatedRows,
    traces: newTraces,
  });
}

function transitionToSafetyBlock() {
  const {
    runtimeRows,
    traces,
    scenarioConfigOverride,
    thisRunConfigOverride,
    startedAt,
  } = useScenarioStore.getState();
  const effectiveConfig = computeEffectiveConfig(
    defaultSkillConfig,
    scenarioConfigOverride,
    thisRunConfigOverride,
  );
  const result = runSkill(effectiveConfig, buildInternalScenario());

  const updatedRows: Record<string, OrderRuntimeRow> = { ...runtimeRows };

  for (const { order, reasons } of result.safetyOverride) {
    const existing = updatedRows[order.id];
    if (!existing) continue;
    updatedRows[order.id] = {
      ...existing,
      status: 'pendingHuman',
      safetyTag: reasons[0] ?? '安全层覆盖',
    };
  }

  for (const { order, reasons } of result.businessAutoApprove) {
    const existing = updatedRows[order.id];
    if (!existing) continue;
    updatedRows[order.id] = {
      ...existing,
      status: 'autoApproved',
      autoApprovedReason: reasons[0] ?? '业务层自动同意',
    };
  }

  for (const { order } of result.manualReview) {
    const existing = updatedRows[order.id];
    if (!existing) continue;
    updatedRows[order.id] = {
      ...existing,
      status: 'pendingHuman',
      safetyTag: '命中但无业务规则触发 → 待人工',
    };
  }

  const newTraces: TraceLog[] = [...traces];
  let cumulativeT = startedAt ? Math.max(800, Date.now() - startedAt) : 800;

  const safetyOverrideIds = new Set(
    result.safetyOverride.map(({ order }) => order.id),
  );
  const businessAutoIds = new Set(
    result.businessAutoApprove.map(({ order }) => order.id),
  );

  for (const order of result.filtered) {
    cumulativeT += 80;
    const isSafety = safetyOverrideIds.has(order.id);
    const isAuto = businessAutoIds.has(order.id);
    const riskLevel = computeRiskLevel(order);
    const ruleApplied = computeRuleApplied(order, result);
    newTraces.push({
      ...RBAC_MOCK,
      id: makeTraceId(newTraces),
      type: 'risk',
      step: 3,
      timestamp: cumulativeT,
      modelUsed: 'gpt-4',
      tokenUsed: 56,
      latencyMs: 240,
      input: { orderId: order.id },
      output: {
        riskLevel,
        safetyBlocked: isSafety,
        autoApproved: isAuto,
        ruleApplied,
      },
    });
  }

  cumulativeT += 320;
  const callSkillRequest: CompletenessAlertRequest = {
    callerSkillId: 'purchaseFollowUp',
    targetOrderId: 'PO-2025-001',
    affectedWorkOrderIds: ['WO-2025-0312', 'WO-2025-0315'],
    requestedAt: cumulativeT,
    timeoutMs: 5000,
  };
  newTraces.push({
    ...RBAC_MOCK,
    id: makeTraceId(newTraces),
    type: 'call-skill',
    step: 3,
    timestamp: cumulativeT,
    modelUsed: 'deepseek-r1',
    tokenUsed: 120,
    latencyMs: 680,
    input: callSkillRequest,
    output: MOCK_COMPLETENESS_ALERT_RESPONSE,
  });

  useScenarioStore.setState({
    currentStep: 'safety-block',
    runtimeRows: updatedRows,
    traces: newTraces,
  });

  // L1 + L2：safety-block 进入时 fire 真 LLM（fire-and-forget，失败静默 fallback）
  fireL1RiskCot();
  fireL2Orchestrate();
}

function computeRiskLevel(po: PurchaseOrder): 'high' | 'medium' | 'low' {
  if (po.isCritical === 'yes') return 'high';
  if (po.isSingleSource === 'yes') return 'high';
  if (po.affectedWorkOrderIds.length > 0) return 'high';
  if (po.customerImportance === 'KA' || po.customerImportance === 'strategic')
    return 'high';
  if (po.supplierReplyStatus === 'repliedDelay') return 'medium';
  if (po.followUpCount >= 2) return 'medium';
  return 'low';
}

function computeRuleApplied(
  po: PurchaseOrder,
  result: ReturnType<typeof runSkill>,
): string[] {
  const safety = result.safetyOverride.find(({ order }) => order.id === po.id);
  if (safety) return safety.reasons;
  const auto = result.businessAutoApprove.find(
    ({ order }) => order.id === po.id,
  );
  if (auto) return auto.reasons;
  const manual = result.manualReview.find(({ order }) => order.id === po.id);
  if (manual) return manual.reasons;
  return [];
}

/** autoPlay 内部：把伪光标移到指定订单的「待人工」按钮上，然后点击 → 派发人工决策。 */
function mockCursorClickWaitingButton(orderId: string) {
  const selector = `[data-cursor-target="po-action-${orderId}"]`;
  const btn = document.querySelector(selector) as HTMLElement | null;
  if (!btn) {
    // fallback: 直接派发决策
    useScenarioStore
      .getState()
      .submitHumanDecision(orderId, 'dispatchToManager', 'mockCursor');
    return;
  }
  const rect = btn.getBoundingClientRect();
  useScenarioStore.setState({
    mockCursor: {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      hint: `${orderId} · 同意派发`,
    },
  });
  const id = window.setTimeout(() => {
    useScenarioStore
      .getState()
      .submitHumanDecision(orderId, 'dispatchToManager', 'mockCursor');
  }, 600);
  useScenarioStore.setState((state) => ({
    playbackTimers: [...state.playbackTimers, id],
  }));
}

// ─── 真 LLM fire-and-forget helpers（demo_scripts §2） ─────────
// 策略：演示模式 100% mock；手动模式 + ?real-llm=token 时背后调真 LLM，
// 结果通过 applyLlmReplacement 写入 store，UI 渲染优先用 replacement。
// 失败时静默 fallback，不打断剧本节奏。

function fireL1RiskCot() {
  if (!isRealLlmEnabled()) return;
  const po = MOCK_PURCHASE_ORDERS['PO-2025-001'];
  if (!po) return;
  const config = useSkillStore.getState().config.automationBoundary;
  callRiskJudge({
    order: po,
    config: { safety: config.safety, business: config.business },
  })
    .then((out) => {
      useScenarioStore.getState().applyLlmReplacement({ riskCot: out.cot });
    })
    .catch((e: unknown) => {
      const msg = e instanceof LlmFetchError ? e.reason : 'unknown';
      useScenarioStore.getState().setLlmError(`L1 失败：${msg}（已 fallback mock）`);
    });
}

function fireL2Orchestrate() {
  if (!isRealLlmEnabled()) return;
  const po = MOCK_PURCHASE_ORDERS['PO-2025-001'];
  if (!po) return;
  callOrchestrate({
    order: po,
    riskLevel: 'high',
    affectedWorkOrderIds: po.affectedWorkOrderIds,
  })
    .then((out) => {
      useScenarioStore
        .getState()
        .applyLlmReplacement({ orchestrateReasoning: out.reasoning });
    })
    .catch((e: unknown) => {
      const msg = e instanceof LlmFetchError ? e.reason : 'unknown';
      useScenarioStore.getState().setLlmError(`L2 失败：${msg}（已 fallback mock）`);
    });
}

function fireL3AnswerQuestion() {
  if (!isRealLlmEnabled()) return;
  const po = MOCK_PURCHASE_ORDERS['PO-2025-005'];
  if (!po) return;
  callAnswerQuestion({
    question: 'PO-005 怎么没自动同意？供应商都回复延期才 1 天了。',
    orderContext: po,
    appliedRules: ['safety.critical', 'business.autoApproveIfDelayLE'],
    decisionResult: 'humanIntervene',
  })
    .then((out) => {
      useScenarioStore.getState().applyLlmReplacement({
        answerExplanation: { text: out.explanation, citedRules: out.citedRules },
      });
    })
    .catch((e: unknown) => {
      const msg = e instanceof LlmFetchError ? e.reason : 'unknown';
      const s = useScenarioStore.getState();
      s.setLlmError(`L3 失败：${msg}（已 fallback mock）`);
      // 关键：标记 L3 已结束（哪怕失败），否则 msg-007 卡在"正在调用真 LLM..."
      s.applyLlmReplacement({ l3FellBack: true });
    });
}

function fireL4ParseConfigIntent() {
  if (!isRealLlmEnabled()) return;
  const cfg = useSkillStore.getState().config.automationBoundary;
  callParseConfigIntent({
    request: '最近天气原因供应商普遍延期，把延期容忍能从 2 天调到 3 天吗？',
    currentConfig: {
      autoApproveIfDelayLE: cfg.business.autoApproveIfDelayLE,
      autoApproveTierA: cfg.business.autoApproveTierA,
      mustHumanIfCustomerKA: cfg.business.mustHumanIfCustomerKA,
      autoApproveAmountLimit: cfg.efficiency.autoApproveAmountLimit,
      maxFollowUpCount: cfg.efficiency.maxFollowUpCount,
    },
  })
    .then((out) => {
      useScenarioStore.getState().applyLlmReplacement({
        parsedConfig:
          out.action === 'reject'
            ? { action: out.action, reason: out.reason, explanation: out.explanation }
            : { action: out.action, value: out.value, explanation: out.explanation },
      });
    })
    .catch((e: unknown) => {
      const msg = e instanceof LlmFetchError ? e.reason : 'unknown';
      useScenarioStore.getState().setLlmError(`L4 失败：${msg}（已 fallback mock）`);
    });
}

// ─── selectors ─────────────────────────────────────────

export function selectGroupedOrderIds(state: ScenarioState): {
  pendingHuman: string[];
  autoApproved: string[];
  humanResolved: string[];
  hit: string[];
  missed: string[];
  idle: string[];
} {
  const groups = {
    pendingHuman: [] as string[],
    autoApproved: [] as string[],
    humanResolved: [] as string[],
    hit: [] as string[],
    missed: [] as string[],
    idle: [] as string[],
  };
  for (const row of Object.values(state.runtimeRows)) {
    groups[row.status as OrderRuntimeStatus].push(row.orderId);
  }
  return groups;
}

export function selectHud(state: ScenarioState): {
  totalTokens: number;
  avgLatencyMs: number;
  cost: number;
} {
  let tokens = 0;
  let latencySum = 0;
  let latencyCount = 0;
  for (const t of state.traces) {
    if (t.tokenUsed) tokens += t.tokenUsed;
    if (t.latencyMs) {
      latencySum += t.latencyMs;
      latencyCount += 1;
    }
  }
  return {
    totalTokens: tokens,
    avgLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
    cost: Number((tokens * 0.0002).toFixed(2)),
  };
}

/** P1 D2：当前 step 的 CoT mock 文本 key（由 cot-traces.ts 提供具体内容） */
export function selectCotStep(state: ScenarioState): number | null {
  return state.cotExpandedStep;
}

// ─── Phase 3 / Debug & Eval selectors（debug_eval_spec §7.3） ──────────

/** 按 step 分组的 trace（左栏 Trace 时间线渲染用） */
export function selectTracesByStep(
  state: ScenarioState,
): Map<number, TraceLog[]> {
  const map = new Map<number, TraceLog[]>();
  for (const t of state.traces) {
    const arr = map.get(t.step) ?? [];
    arr.push(t);
    map.set(t.step, arr);
  }
  return map;
}

/**
 * 从 trace 反向解析关联订单 ID 列表（debug_eval_spec §4.3）。
 * - filter/risk/human-decision: 单 `input.orderId`
 * - call-skill: 单 `input.targetOrderId`
 * - config-change: 多个 `output.affectedOrderIds`
 * - intent: 空
 */
export function resolveOrderIds(trace: TraceLog): string[] {
  switch (trace.type) {
    case 'filter':
    case 'risk':
    case 'human-decision':
      return [trace.input.orderId];
    case 'call-skill':
      return [trace.input.targetOrderId];
    case 'config-change':
      return trace.output.affectedOrderIds;
    case 'intent':
      return [];
  }
}

/** type + 订单 ID 过滤（P0 filter 用） */
export function filterTraces(
  traces: TraceLog[],
  types: TraceLog['type'][],
  orderId: string | null,
): TraceLog[] {
  return traces.filter((t) => {
    if (!types.includes(t.type)) return false;
    if (orderId === null) return true;
    return resolveOrderIds(t).includes(orderId);
  });
}

// ─── Metric struct + selectMetrics（debug_eval_spec §5 + §7.3） ────────

export type MetricDirection = 'higherBetter' | 'lowerBetter' | 'rangeTarget';

export interface Metric {
  actual: number;
  /** target: number for higher/lowerBetter, [low, high] for rangeTarget */
  target: number | [number, number];
  direction: MetricDirection;
  /** 显示单位（"%" / "ms" / "¥" / null）—— null 表示纯数字 */
  unit: string | null;
}

export interface MetricsSnapshot {
  hitRate: Metric;
  safetyRate: Metric;
  autoApproveRate: Metric;
  manualReviewRate: Metric;
  callSkillSuccess: Metric;
  avgToken: Metric;
  avgLatency: Metric;
  totalCost: Metric;
}

/**
 * 指标计算 —— actual 来自 trace 真实计数，target 是 PD-6 示意基准。
 * ⚠️ 返回新对象 → 调用方必须 useShallow(selectMetrics)。
 */
export function selectMetrics(state: ScenarioState): MetricsSnapshot {
  const traces = state.traces;

  const filterTracesOnly = traces.filter(
    (t): t is Extract<TraceLog, { type: 'filter' }> => t.type === 'filter',
  );
  const riskTraces = traces.filter(
    (t): t is Extract<TraceLog, { type: 'risk' }> => t.type === 'risk',
  );
  const callSkillTraces = traces.filter(
    (t): t is Extract<TraceLog, { type: 'call-skill' }> => t.type === 'call-skill',
  );

  const totalFiltered = filterTracesOnly.length;
  const hitCount = filterTracesOnly.filter((t) => t.output.hit).length;
  const safetyBlockedCount = riskTraces.filter(
    (t) => t.output.safetyBlocked,
  ).length;
  const autoApprovedCount = riskTraces.filter(
    (t) => t.output.autoApproved,
  ).length;
  const manualReviewCount = riskTraces.length - safetyBlockedCount - autoApprovedCount;
  const callSkillOkCount = callSkillTraces.filter(
    (t) => t.output.status === 'ok',
  ).length;

  // 总 token / 延迟
  let tokens = 0;
  let latencySum = 0;
  let latencyCount = 0;
  for (const t of traces) {
    if (t.tokenUsed) tokens += t.tokenUsed;
    if (t.latencyMs) {
      latencySum += t.latencyMs;
      latencyCount += 1;
    }
  }
  const decisionsCount = riskTraces.length || 1;

  // 安全分母 —— 没跑剧本时返回 0 而不是 NaN
  const safeDivide = (a: number, b: number) => (b === 0 ? 0 : a / b);

  return {
    hitRate: {
      actual: totalFiltered === 0 ? 0 : safeDivide(hitCount, totalFiltered),
      target: 0.6,
      direction: 'higherBetter',
      unit: '%',
    },
    safetyRate: {
      actual: safeDivide(safetyBlockedCount, hitCount),
      target: [0.25, 0.4],
      direction: 'rangeTarget',
      unit: '%',
    },
    autoApproveRate: {
      actual: safeDivide(autoApprovedCount, hitCount),
      target: 0.25,
      direction: 'higherBetter',
      unit: '%',
    },
    manualReviewRate: {
      actual: safeDivide(safetyBlockedCount + manualReviewCount, hitCount),
      target: 0.5,
      direction: 'lowerBetter',
      unit: '%',
    },
    callSkillSuccess: {
      actual:
        callSkillTraces.length === 0
          ? 0
          : safeDivide(callSkillOkCount, callSkillTraces.length),
      target: 0.95,
      direction: 'higherBetter',
      unit: '%',
    },
    avgToken: {
      actual: Math.round(tokens / decisionsCount),
      target: 2000,
      direction: 'lowerBetter',
      unit: null,
    },
    avgLatency: {
      actual: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
      target: 500,
      direction: 'lowerBetter',
      unit: 'ms',
    },
    totalCost: {
      actual: Number((tokens * 0.0002).toFixed(2)),
      target: 1,
      direction: 'lowerBetter',
      unit: '¥',
    },
  };
}

/** 信号灯计算（§5.4） */
export function metricSignal(m: Metric): 'green' | 'yellow' | 'red' {
  const a = m.actual;
  if (m.direction === 'higherBetter') {
    const t = m.target as number;
    if (a >= t) return 'green';
    if (a >= t * 0.8) return 'yellow';
    return 'red';
  }
  if (m.direction === 'lowerBetter') {
    const t = m.target as number;
    if (a <= t) return 'green';
    if (a <= t * 1.2) return 'yellow';
    return 'red';
  }
  // rangeTarget
  const [low, high] = m.target as [number, number];
  if (a >= low && a <= high) return 'green';
  if (a >= low * 0.8 && a <= high * 1.2) return 'yellow';
  return 'red';
}
