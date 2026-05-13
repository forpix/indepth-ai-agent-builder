import type { SkillConfig } from '@/types/skill';

/**
 * SkillConfig → TS 代码字符串。
 *
 * D-2：只读视图。Code View 输出的代码结构与 src/types/skill.ts 中
 * 的 SkillConfig 接口一致（PD-4：分级转换，结构 1:1，不承诺双向无损编辑）。
 */
export function generateSkillCode(config: SkillConfig): string {
  const body = stringify(config, 0);
  return [
    "import { Skill } from '@digiwin/indepth-ai-sdk';",
    '',
    '/**',
    ' * 制造业采购交期跟催 Skill',
    ' *',
    ' * 由 Skill Builder 低代码配置生成 — 当前为 v1 静态映射，',
    ' * 结构与 src/types/skill.ts 的 SkillConfig 接口完全一致。',
    ' *',
    ' * D-2：v1 只读视图。v2 双向编辑（代码修改回写 LowCode）在产品路线图。',
    ' */',
    'export const PurchaseFollowUpSkill = new Skill(',
    `${body},`,
    ');',
    '',
  ].join('\n');
}

// ── 内部：JS 友好的 stringify ───────────────────────

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function stringify(value: unknown, depth: number): string {
  const pad = '  '.repeat(depth);
  const nextPad = '  '.repeat(depth + 1);

  if (value === null) return 'null';
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value
      .map((v) => `${nextPad}${stringify(v, depth + 1)}`)
      .join(',\n');
    return `[\n${items},\n${pad}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) return '{}';
    const lines = entries
      .map(([k, v]) => {
        const key = IDENT_RE.test(k) ? k : `'${k}'`;
        return `${nextPad}${key}: ${stringify(v, depth + 1)}`;
      })
      .join(',\n');
    return `{\n${lines},\n${pad}}`;
  }
  return 'unknown';
}
