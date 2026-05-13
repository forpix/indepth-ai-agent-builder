import type { Conflict, SkillConfig } from '@/types/skill';

/**
 * 冲突检测器 —— spec §12.3 用硬编码规则 + useMemo，不上规则引擎。
 *
 * 规则集（v1 完整 5 条）：
 *  1. 4 个触发全关
 *  2. 关键件 + 业务层「延期 ≤ N 天自动同意」开 → 安全层覆盖
 *  3. 单一来源 + 业务层任一自动同意开 → 安全层覆盖
 *  4. 影响在制工单 + 业务层任一自动同意开 → 安全层覆盖
 *  5. 跟催次数上限 < 1 → 兜底冲突（schema 限定 1-5，防御性规则展示「平台兜底思维」）
 *
 * 输出的 conflict.overrides 是 SkillConfig 上的 dotted paths，
 * 用于 UI 在对应配置项行上加删除线 + warning 边框（决策 D 选项 2）。
 */
export function detectConflicts(config: SkillConfig): Conflict[] {
  const conflicts: Conflict[] = [];

  // ── 规则 1：四种触发全部关闭 ──────────────────────
  const t = config.triggers;
  const anyTriggerOn =
    t.schedule.enabled ||
    t.manual.enabled ||
    t.naturalLanguage.enabled ||
    t.event.enabled;
  if (!anyTriggerOn) {
    conflicts.push({
      id: 'no-trigger-enabled',
      severity: 'error',
      title: '至少需要启用一种触发方式',
      detail:
        '当前四种触发方式（事件 / 定时 / 自然语言 / 手动）全部关闭，Skill 永远不会被执行。',
      source: 'triggers',
    });
  }

  // ── 安全层 vs 业务层 ──────────────────────────────
  const business = config.automationBoundary.business;
  const autoApproveDelayOn = business.autoApproveIfDelayLE.enabled;
  const autoApproveTierAOn = business.autoApproveTierA;
  const anyAutoApproveOn = autoApproveDelayOn || autoApproveTierAOn;

  // 当前启用的所有业务层自动同意路径 —— 多个冲突规则会复用
  const enabledAutoApprovePaths = (): string[] => {
    const paths: string[] = [];
    if (autoApproveDelayOn)
      paths.push('automationBoundary.business.autoApproveIfDelayLE');
    if (autoApproveTierAOn)
      paths.push('automationBoundary.business.autoApproveTierA');
    return paths;
  };

  // 规则 2：关键件 + 业务层延期自动同意
  if (config.filters.material.isCritical === 'yes' && autoApproveDelayOn) {
    conflicts.push({
      id: 'critical-vs-auto-approve-delay',
      severity: 'warning',
      title: '关键件订单将被安全层强制人工',
      detail: `已勾选「关键件 = 是」，业务层「延期 ≤ ${business.autoApproveIfDelayLE.days} 天自动同意」在此场景下不生效。关键件由安全层硬规则保护，永远走人工复核。`,
      source: 'filters',
      overriddenBy: 'automationBoundary',
      overrides: ['automationBoundary.business.autoApproveIfDelayLE'],
    });
  }

  // 规则 3：单一来源 + 任一业务层自动同意
  if (config.filters.material.isSingleSource === 'yes' && anyAutoApproveOn) {
    conflicts.push({
      id: 'single-source-vs-auto-approve',
      severity: 'warning',
      title: '单一来源料件将被安全层强制人工',
      detail:
        '已勾选「单一来源 = 是」。单一来源料件供应风险高，业务层的自动同意规则（延期容忍 / A 级供应商）在此场景下不生效。',
      source: 'filters',
      overriddenBy: 'automationBoundary',
      overrides: enabledAutoApprovePaths(),
    });
  }

  // 规则 4：影响在制工单 + 任一业务层自动同意
  if (config.filters.impact.affectsWorkOrder && anyAutoApproveOn) {
    conflicts.push({
      id: 'workorder-vs-auto-approve',
      severity: 'warning',
      title: '影响在制工单的订单将被安全层强制人工',
      detail:
        '已勾选「影响在制工单」。延期会扰动 MES 排产计划，业务层的自动同意规则在此场景下不生效。',
      source: 'filters',
      overriddenBy: 'automationBoundary',
      overrides: enabledAutoApprovePaths(),
    });
  }

  // ── 规则 5：跟催次数上限 < 1 ──────────────────────
  if (config.automationBoundary.efficiency.maxFollowUpCount < 1) {
    conflicts.push({
      id: 'max-followup-too-low',
      severity: 'error',
      title: '跟催次数上限不能小于 1',
      detail:
        '上限 < 1 时二次跟催将立即升级到人工，效率层兜底约束失效。建议至少 1 次。',
      source: 'automationBoundary',
    });
  }

  return conflicts;
}

/** 从冲突列表中聚合所有被覆盖的字段路径（dotted），供 UI 在配置项上加删除线 */
export function collectOverriddenPaths(conflicts: Conflict[]): Set<string> {
  const set = new Set<string>();
  for (const c of conflicts) {
    if (!c.overrides) continue;
    for (const p of c.overrides) set.add(p);
  }
  return set;
}
