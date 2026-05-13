import { create } from 'zustand';

/**
 * Eval & Trace 状态（Phase 3）。
 * 接收 agentStore 产生的 trace 日志和聚合指标，用于 Debug & Eval 屏渲染。
 */
interface EvalState {
  // Phase 3 实现
  _placeholder?: never;
}

export const useEvalStore = create<EvalState>(() => ({}));
