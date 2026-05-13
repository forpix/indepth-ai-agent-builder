import { create } from 'zustand';

/**
 * Agent 运行时状态（Phase 2）。
 * 对话流 / 订单表 / Agent 决策 trace 都集中在此处，供 Debug & Eval 屏共享。
 */
interface AgentState {
  // Phase 2 实现
  _placeholder?: never;
}

export const useAgentStore = create<AgentState>(() => ({}));
