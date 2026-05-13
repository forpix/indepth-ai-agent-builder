import { useMemo } from 'react';

import {
  collectOverriddenPaths,
  detectConflicts,
} from '@/lib/conflict-detector';
import { useSkillStore } from '@/stores/skill-store';

/**
 * 订阅 Skill 配置变化、实时计算冲突 —— PD-5 用 useMemo 而不是手动触发。
 */
export function useConflicts() {
  const config = useSkillStore((s) => s.config);
  return useMemo(() => detectConflicts(config), [config]);
}

/**
 * 从当前冲突列表导出被"安全层"覆盖的字段路径集合。
 * 业务层模块用它给对应的 Switch / Slider 行加删除线 + warning 边框（决策 D 选项 2）。
 */
export function useOverriddenPaths() {
  const conflicts = useConflicts();
  return useMemo(() => collectOverriddenPaths(conflicts), [conflicts]);
}
