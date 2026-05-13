import { create } from 'zustand';

import { defaultSkillConfig } from '@/lib/skill-defaults';
import type { SkillConfig } from '@/types/skill';

type ViewMode = 'lowCode' | 'codeView';

interface SkillState {
  config: SkillConfig;
  viewMode: ViewMode;

  /**
   * Immer 风格更新：传一个 mutator 函数，内部 structuredClone 后 mutate，再返回 next。
   * 用法：`setConfig(c => { c.filters.material.isCritical = 'yes'; })`
   * 不引入 immer 是为了避免依赖膨胀 —— structuredClone 是 Node 17+ / 现代浏览器原生 API。
   */
  setConfig: (mutator: (draft: SkillConfig) => void) => void;
  reset: () => void;
  setViewMode: (mode: ViewMode) => void;
}

export const useSkillStore = create<SkillState>((set) => ({
  config: defaultSkillConfig,
  viewMode: 'lowCode',

  setConfig: (mutator) =>
    set((state) => {
      const next = structuredClone(state.config);
      mutator(next);
      return { config: next };
    }),

  reset: () => set({ config: structuredClone(defaultSkillConfig) }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));
