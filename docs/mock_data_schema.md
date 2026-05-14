# Mock 数据 Schema v1.0

> Phase 2 Agent Console 复合剧本依赖的 10 条采购订单数据定义 + 规则纯函数 + 预期状态矩阵。
> 用途：作为剧本数字（"命中 6/10"、"安全层覆盖 4 条" 等）的唯一来源，所有 UI 组件、Trace、复盘图必须从本表反推。
> 关联：`docs/agent_console_spec.md` §3 复合剧本、`src/types/mock-data.ts` `PurchaseOrder` 类型。

---

## 0. 文档定位

本文档解决 Codex 对抗式审查的 P0-1：**Mock 数据和规则计算契约缺失**。

在没有本表之前，spec §3 的剧本数字（命中数、安全层覆盖数、自动同意数）和 Trace、复盘图之间会自相矛盾——任意改一条订单就会导致 UI 显示和叙事数字脱节。

**强约束**：

- `src/mocks/purchase-orders.ts` 的数据必须**严格匹配** §2 表
- `src/lib/skill-runner.ts` 的规则判断必须**严格匹配** §3 纯函数定义
- `docs/agent_console_spec.md` §3 剧本里出现的所有数字必须**从 §4 矩阵反推**

如果三者不一致，以本文档为准。

---

## 1. PurchaseOrder 字段定义

字段类型完全沿用 `src/types/mock-data.ts`，本节仅做业务层面的解释和取值约束，不重复声明类型。

| 字段 | 类型 | 必填 | 取值范围 / 约束 | 业务含义 |
|------|------|------|---------------|---------|
| `id` | string | ✓ | `PO-2025-XXX` | 采购单号 |
| `materialCode` | string | ✓ | 工业级编码，3-4 段（如 `FAS-M8-A270-001`） | 物料编码 |
| `materialName` | string | ✓ | 中文，含规格 | 物料中文名 |
| `quantity` | number | ✓ | 整数 ≥ 1 | 采购数量 |
| `amount` | number | ✓ | 元，整数 | 订单总金额 |
| `supplierId` | string | ✓ | `SUP-XNNNN` | 供应商 ID |
| `supplierName` | string | ✓ | 中文 | 供应商名称 |
| `supplierTier` | `'A' \| 'B' \| 'C'` | ✓ | — | 供应商等级 |
| `supplierDelayRate` | number | ✓ | 0-1（百分比小数） | 近 90 天历史延期率 |
| `dueInDays` | number | ✓ | 可正可负 | 距预计到货日天数，负数已到期 |
| `completed` | boolean | ✓ | — | 是否已完结 |
| `supplierReplyStatus` | `'notReplied' \| 'repliedDelay' \| 'repliedConfirm'` | ✓ | — | 供应商回复状态 |
| `supplierDelayReply` | number | (条件) | 整数 ≥ 1 | 仅当 `replyStatus = repliedDelay` 时必填，表示供应商承诺的延期天数 |
| `isCritical` | `'yes' \| 'no'` | ✓ | 二态（订单上是事实属性，不是筛选条件） | 是否关键件 |
| `isSingleSource` | `'yes' \| 'no'` | ✓ | — | 是否单一来源 |
| `hasAlternative` | `'yes' \| 'no'` | ✓ | — | 是否有替代料 |
| `affectedWorkOrderIds` | string[] | ✓ | `WO-2025-NNNN`，可空数组 | 影响在制工单 ID |
| `affectsMRP` | boolean | ✓ | — | 是否影响 MRP 计划 |
| `affectedCustomerOrderIds` | string[] | ✓ | `SO-2025-NNNN`，可空数组 | 影响客户订单 ID |
| `customerImportance` | `'normal' \| 'KA' \| 'strategic'` | ✓ | — | 影响客户的最高重要性 |
| `followUpCount` | number | ✓ | 0-N | 历史跟催次数 |

**注意**：

- 物料属性字段（`isCritical` / `isSingleSource` / `hasAlternative`）在订单上是**二态**，因为这是事实属性。在 Skill Builder 的筛选规则里才是三态（`'yes' | 'no' | 'any'`），因为那里是"包含/排除/不约束"语义。
- `supplierDelayReply` 是供应商主动回复的承诺延期天数，不是 Agent 计算的"延期天数"——含义不同。

---

## 2. 10 条订单数据

剧本前提：所有订单的"当前时间"基准点为同一天，`dueInDays` 都相对这一天。

### 2.1 精简概览表（剧本叙事用）

只列影响剧本判断的核心字段。**完整 TS fixture 在 §2.2**，是 `src/mocks/purchase-orders.ts` 的唯一来源。

| ID | 物料 | 等级 | 延期率 | 到货 | 完结 | 回复状态 | 延期 | 金额 | 关键件 | 单一源 | 影响工单 | KA |
|----|------|------|--------|------|------|---------|------|------|--------|--------|---------|-----|
| PO-2025-001 | 高强度内六角螺栓 | A | 0.38 | 3 天 | 否 | notReplied | — | ¥28,500 | yes | no | 2 张 | — |
| PO-2025-002 | 伺服驱动主控板 V3 | A | 0.22 | 5 天 | 否 | notReplied | — | ¥152,000 | yes | yes | — | KA |
| PO-2025-003 | 环氧树脂粘合剂 | **C** | 0.15 | 5 天 | 否 | notReplied | — | ¥2,800 | no | no | — | — |
| PO-2025-004 | 深沟球轴承 6204 | A | 0.18 | 4 天 | 否 | repliedDelay | **2** | **¥6,800** | no | no | — | — |
| PO-2025-005 | 控制板 V3 B 型 | A | 0.22 | 5 天 | 否 | repliedDelay | **1** | **¥9,500** | yes | no | — | — |
| PO-2025-006 | 中转纸箱 A4 | B | 0.10 | **14 天** | 否 | notReplied | — | ¥5,200 | no | no | — | — |
| PO-2025-007 | 7075-T6 铝合金型材 | A | 0.31 | 4 天 | 否 | notReplied | — | ¥45,000 | yes | yes | 1 张 | — |
| PO-2025-008 | 内六角螺栓 M6 | B | 0.20 | -2 天 | **是** | notReplied | — | ¥12,500 | no | no | — | — |
| PO-2025-009 | 不锈钢焊丝 308L | **B** | 0.25 | 6 天 | 否 | repliedDelay | **3** | **¥8,200** | no | no | — | — |
| PO-2025-010 | 三相异步电机 15kW | A | 0.12 | 4 天 | 否 | repliedConfirm | — | ¥67,500 | no | no | — | — |

### 2.1.1 金额上限对自动同意路径的影响（呼应 C5 / §3.4）

效率层默认 `autoApproveAmountLimit = ¥10,000`。3 条命中且有"业务层自动同意潜力"的订单中：

| ID | 金额 | 是否 ≤ ¥10,000 | 影响 |
|----|------|---------------|------|
| PO-2025-004 | ¥6,800 | ✓ | 调参前后均能自动同意 |
| PO-2025-005 | ¥9,500 | ✓ | 业务层规则会触发但被安全层（关键件）覆盖；如果**没有**安全层，金额上也够格自动同意——这是"业务被安全覆盖"剧情成立的前提 |
| PO-2025-009 | ¥8,200 | ✓ | 调参后能自动同意 |

**为什么 PO-005 不能用伺服板的高价物料？** 早期设计 PO-005 是"伺服驱动主控板"（¥18,600+），但金额超 ¥10,000 上限会让业务层规则**根本不触发**（被效率层兜底拦在前面）——这样 §3.5 "业务层规则真实触发但被安全层覆盖"的剧情就垮了。PO-005 改为更小巧的"控制板 V3 B 型 50 件 × ¥190" = ¥9,500，金额贴近上限但不超，剧本逻辑完整。

### 2.2 完整 TS fixture（`src/mocks/purchase-orders.ts` 的唯一来源）

这是 10 条订单的**完整字段值**。Phase 2 实现 `src/mocks/purchase-orders.ts` 时必须按此一字不差实现；后续任何剧本数字变更必须先改这里，再让代码跟随。

```typescript
import type { PurchaseOrder } from '@/types/mock-data';

export const MOCK_PURCHASE_ORDERS: Record<string, PurchaseOrder> = {
  'PO-2025-001': {
    id: 'PO-2025-001',
    materialCode: 'FAS-M8-A270-001',
    materialName: '高强度内六角螺栓 M8×40',
    quantity: 5000,
    amount: 28500,
    supplierId: 'SUP-A2103',
    supplierName: '苏州精工紧固件',
    supplierTier: 'A',
    supplierDelayRate: 0.38,
    dueInDays: 3,
    completed: false,
    supplierReplyStatus: 'notReplied',
    isCritical: 'yes',
    isSingleSource: 'no',
    hasAlternative: 'yes',
    affectedWorkOrderIds: ['WO-2025-0312', 'WO-2025-0315'],
    affectsMRP: true,
    affectedCustomerOrderIds: [],
    customerImportance: 'normal',
    followUpCount: 0,
  },
  'PO-2025-002': {
    id: 'PO-2025-002',
    materialCode: 'SMT-CTRL-V3-A22',
    materialName: '伺服驱动主控板组件 V3',
    quantity: 80,
    amount: 152000,
    supplierId: 'SUP-A0418',
    supplierName: '深圳芯讯电子',
    supplierTier: 'A',
    supplierDelayRate: 0.22,
    dueInDays: 5,
    completed: false,
    supplierReplyStatus: 'notReplied',
    isCritical: 'yes',
    isSingleSource: 'yes',
    hasAlternative: 'no',
    affectedWorkOrderIds: ['WO-2025-0421'],
    affectsMRP: false,
    affectedCustomerOrderIds: ['SO-2025-A077'],
    customerImportance: 'KA',
    followUpCount: 2,
  },
  'PO-2025-003': {
    id: 'PO-2025-003',
    materialCode: 'CHE-EPX-RS-100',
    materialName: '环氧树脂粘合剂 100ml',
    quantity: 500,
    amount: 2800,
    supplierId: 'SUP-C0617',
    supplierName: '常州化工辅料',
    supplierTier: 'C',
    supplierDelayRate: 0.15,
    dueInDays: 5,
    completed: false,
    supplierReplyStatus: 'notReplied',
    isCritical: 'no',
    isSingleSource: 'no',
    hasAlternative: 'yes',
    affectedWorkOrderIds: [],
    affectsMRP: false,
    affectedCustomerOrderIds: [],
    customerImportance: 'normal',
    followUpCount: 0,
  },
  'PO-2025-004': {
    id: 'PO-2025-004',
    materialCode: 'BRG-DGN-6204',
    materialName: '深沟球轴承 6204-2RS',
    quantity: 200,
    amount: 6800,
    supplierId: 'SUP-A0512',
    supplierName: '常州轴承制造',
    supplierTier: 'A',
    supplierDelayRate: 0.18,
    dueInDays: 4,
    completed: false,
    supplierReplyStatus: 'repliedDelay',
    supplierDelayReply: 2,
    isCritical: 'no',
    isSingleSource: 'no',
    hasAlternative: 'yes',
    affectedWorkOrderIds: [],
    affectsMRP: false,
    affectedCustomerOrderIds: [],
    customerImportance: 'normal',
    followUpCount: 1,
  },
  'PO-2025-005': {
    id: 'PO-2025-005',
    materialCode: 'SMT-CTRL-V3-B11',
    materialName: '控制板 V3 B 型',
    quantity: 50,
    amount: 9500,
    supplierId: 'SUP-A0418',
    supplierName: '深圳芯讯电子',
    supplierTier: 'A',
    supplierDelayRate: 0.22,
    dueInDays: 5,
    completed: false,
    supplierReplyStatus: 'repliedDelay',
    supplierDelayReply: 1,
    isCritical: 'yes',
    isSingleSource: 'no',
    hasAlternative: 'yes',
    affectedWorkOrderIds: [],
    affectsMRP: false,
    affectedCustomerOrderIds: [],
    customerImportance: 'normal',
    followUpCount: 0,
  },
  'PO-2025-006': {
    id: 'PO-2025-006',
    materialCode: 'PCK-CTN-A4',
    materialName: '中转纸箱 A4 规格',
    quantity: 2000,
    amount: 5200,
    supplierId: 'SUP-B0904',
    supplierName: '昆山包装材料',
    supplierTier: 'B',
    supplierDelayRate: 0.10,
    dueInDays: 14,
    completed: false,
    supplierReplyStatus: 'notReplied',
    isCritical: 'no',
    isSingleSource: 'no',
    hasAlternative: 'yes',
    affectedWorkOrderIds: [],
    affectsMRP: false,
    affectedCustomerOrderIds: [],
    customerImportance: 'normal',
    followUpCount: 0,
  },
  'PO-2025-007': {
    id: 'PO-2025-007',
    materialCode: 'CST-AL-7075-T6',
    materialName: '7075-T6 铝合金型材',
    quantity: 30,
    amount: 45000,
    supplierId: 'SUP-A0331',
    supplierName: '南京金属制品',
    supplierTier: 'A',
    supplierDelayRate: 0.31,
    dueInDays: 4,
    completed: false,
    supplierReplyStatus: 'notReplied',
    isCritical: 'yes',
    isSingleSource: 'yes',
    hasAlternative: 'no',
    affectedWorkOrderIds: ['WO-2025-0408'],
    affectsMRP: false,
    affectedCustomerOrderIds: [],
    customerImportance: 'normal',
    followUpCount: 1,
  },
  'PO-2025-008': {
    id: 'PO-2025-008',
    materialCode: 'FAS-M6-A270-002',
    materialName: '内六角螺栓 M6×25',
    quantity: 3000,
    amount: 12500,
    supplierId: 'SUP-B0507',
    supplierName: '苏州精工紧固件',
    supplierTier: 'B',
    supplierDelayRate: 0.20,
    dueInDays: -2,
    completed: true,
    supplierReplyStatus: 'notReplied',
    isCritical: 'no',
    isSingleSource: 'no',
    hasAlternative: 'yes',
    affectedWorkOrderIds: [],
    affectsMRP: false,
    affectedCustomerOrderIds: [],
    customerImportance: 'normal',
    followUpCount: 2,
  },
  'PO-2025-009': {
    id: 'PO-2025-009',
    materialCode: 'WLD-MIG-308L',
    materialName: '不锈钢焊丝 308L Φ1.2',
    quantity: 100,
    amount: 8200,
    supplierId: 'SUP-B1142',
    supplierName: '无锡焊材科技',
    supplierTier: 'B',
    supplierDelayRate: 0.25,
    dueInDays: 6,
    completed: false,
    supplierReplyStatus: 'repliedDelay',
    supplierDelayReply: 3,
    isCritical: 'no',
    isSingleSource: 'no',
    hasAlternative: 'yes',
    affectedWorkOrderIds: [],
    affectsMRP: false,
    affectedCustomerOrderIds: [],
    customerImportance: 'normal',
    followUpCount: 0,
  },
  'PO-2025-010': {
    id: 'PO-2025-010',
    materialCode: 'MTR-AC-3PH-15K',
    materialName: '三相异步电机 15kW',
    quantity: 5,
    amount: 67500,
    supplierId: 'SUP-A0123',
    supplierName: '宁波电机厂',
    supplierTier: 'A',
    supplierDelayRate: 0.12,
    dueInDays: 4,
    completed: false,
    supplierReplyStatus: 'repliedConfirm',
    isCritical: 'no',
    isSingleSource: 'no',
    hasAlternative: 'no',
    affectedWorkOrderIds: [],
    affectsMRP: false,
    affectedCustomerOrderIds: [],
    customerImportance: 'normal',
    followUpCount: 0,
  },
};
```

### 2.3 剧本关键订单（spec §3 反复引用）

- **PO-2025-001** Step 3 主角：关键件 + 影响在制工单 → 触发安全层 + 调用齐套预警 Skill
- **PO-2025-005** Step 4 主角：A 级供应商已回复延期 1 天 + 关键件——业务层「延期 ≤ 2 天自动同意」**真实会触发**，但被安全层（关键件）覆盖。这是剧本里**唯一一条"业务层规则会触发但被安全层挡住"**的订单，是规则优先级可视化（§3.5 右栏）的真实演示对象。
- **PO-2025-009** Step 5 主角：B 级供应商已回复延期 3 天——调参前不被业务层自动同意（3 > 阈值 2），调参后被自动同意（3 ≤ 阈值 3）

### 2.4 PO-2025-004 / 005 / 009 三条 repliedDelay 订单的对照设计

剧本里有三条 `repliedDelay` 订单，承担互补的演示职责，避免"撞戏"：

| ID | 延期天数 | 关键属性 | 调参前 | 调参后 |
|----|---------|---------|--------|--------|
| PO-2025-004 | 2 | 普通件 + A 级 | **业务层自动同意**（延期 2 ≤ 阈值 2） | 仍自动同意 |
| PO-2025-005 | 1 | **关键件** + A 级 | 业务层会触发（1 ≤ 2）但**被安全层覆盖** → 人工 | 仍人工（安全层永远不变） |
| PO-2025-009 | 3 | 普通件 + B 级 | 业务层不触发（3 > 阈值 2） → 待人工 | 业务层触发（3 ≤ 新阈值 3）→ **自动同意** |

这三条订单组成"业务层 vs 业务层不同延期值"、"业务层 vs 安全层"、"业务层 vs 配置调整"三个对照剧情，演示信息密度高且每条订单的产品判断点不重叠。

---

## 3. 规则纯函数定义

所有规则判断必须实现为**无副作用的纯函数**，接受订单 + Skill 配置作为输入，返回确定值。

### 3.1 `isHit(po, filter)` — 是否命中筛选规则

```typescript
function isHit(po: PurchaseOrder, filter: FilterConfig): boolean {
  // 时间筛选
  if (po.dueInDays > filter.time.dueInDays) return false;
  if (filter.time.excludeCompleted && po.completed) return false;

  // 供应商筛选
  if (!filter.supplier.replyStatus.includes(po.supplierReplyStatus)) return false;
  if (filter.supplier.tier.length > 0 && !filter.supplier.tier.includes(po.supplierTier)) return false;
  // 历史延期率阈值：仅当 mode='active' 时启用（spec §4.2）
  // 业务含义：跟催延期率 ≥ threshold 的供应商。
  // ⚠️ 演示剧本里这条阈值会被改为 0（关闭过滤），见 §5。
  if (filter.mode === 'active'
      && po.supplierDelayRate < filter.supplier.delayRateThreshold) {
    return false;
  }

  // 物料属性三态匹配（'any' 表示不约束）
  if (!matchTristate(filter.material.isCritical, po.isCritical)) return false;
  if (!matchTristate(filter.material.isSingleSource, po.isSingleSource)) return false;
  if (!matchTristate(filter.material.hasAlternative, po.hasAlternative)) return false;

  // 影响范围（仅在筛选规则开启时才约束）
  if (filter.impact.affectsWorkOrder && po.affectedWorkOrderIds.length === 0) return false;
  if (filter.impact.affectsMRP && !po.affectsMRP) return false;
  if (filter.impact.affectsCustomerOrder && po.affectedCustomerOrderIds.length === 0) return false;
  // customerImportanceFloor：默认 'all' 不约束。当配置为 'KA' / 'strategic' 时收紧
  if (filter.impact.affectsCustomerOrder
      && filter.impact.customerImportanceFloor !== 'all'
      && !meetsCustomerImportance(po.customerImportance, filter.impact.customerImportanceFloor)) {
    return false;
  }

  return true;
}

function matchTristate(filterValue: 'yes' | 'no' | 'any', poValue: 'yes' | 'no'): boolean {
  if (filterValue === 'any') return true;
  return filterValue === poValue;
}

function meetsCustomerImportance(
  poImportance: 'normal' | 'KA' | 'strategic',
  floor: 'KA' | 'strategic'
): boolean {
  if (floor === 'KA') return poImportance === 'KA' || poImportance === 'strategic';
  if (floor === 'strategic') return poImportance === 'strategic';
  return false;
}
```

**关键说明**（5-C4 修正：所有"改 default" 描述已移除，仅引用 §5 覆盖方案）：

- 剧本运行用的是 **effective config** = `defaultSkillConfig` deep-merge `scenarioConfigOverride`（详见 §5）
- **`defaultSkillConfig` 在 Phase 2 实现时不能改**：保持 `filter.supplier.replyStatus = ['notReplied']`、`filter.supplier.delayRateThreshold = 0.3`
- 剧本所需的两处放宽（`replyStatus` 含 `repliedDelay` + `delayRateThreshold = 0`）由 `scenario-store` 在 Step 1 启动时通过 `scenarioConfigOverride` 覆盖
- 不做覆盖时 PO-004 / PO-005 / PO-009 都不会命中，Step 5 炫点失效——但这是**剧本场景的特殊需求，不是 default 应该背的锅**

**Phase 2 验收自检**（防止未来误改 default）：

```typescript
// 一个最小单测，写在 src/lib/skill-defaults.test.ts
import { defaultSkillConfig } from './skill-defaults';
test('defaultSkillConfig 不能被剧本污染', () => {
  expect(defaultSkillConfig.filters.supplier.replyStatus).toEqual(['notReplied']);
  expect(defaultSkillConfig.filters.supplier.delayRateThreshold).toBe(0.3);
});
```

虽然 CLAUDE.md §5.4 说"demo 不需要单元测试"，但此处的单测是**契约护栏**（防止 PR 把 demo 需求拖进 default），不是逻辑测试，例外允许。

### 3.2 `riskLevel(po)` — 风险等级

```typescript
function riskLevel(po: PurchaseOrder): 'high' | 'medium' | 'low' {
  // 高风险：触发任一安全层硬规则
  if (po.isCritical === 'yes') return 'high';
  if (po.isSingleSource === 'yes') return 'high';
  if (po.affectedWorkOrderIds.length > 0) return 'high';
  if (po.customerImportance === 'KA' || po.customerImportance === 'strategic') return 'high';

  // 中等：有延期事实或多次跟催
  if (po.supplierReplyStatus === 'repliedDelay') return 'medium';
  if (po.followUpCount >= 2) return 'medium';

  return 'low';
}
```

### 3.3 `safetyBlocked(po, automation)` — 是否被安全层覆盖

```typescript
function safetyBlocked(po: PurchaseOrder, automation: AutomationBoundary): boolean {
  // 安全层四条硬规则任一触发即返回 true
  if (automation.safety.critical === 'mustHuman' && po.isCritical === 'yes') return true;
  if (automation.safety.singleSource === 'mustHuman' && po.isSingleSource === 'yes') return true;
  if (automation.safety.affectsWorkOrder === 'mustHuman' && po.affectedWorkOrderIds.length > 0) return true;
  // financialCompliance 暂不在订单字段里建模（v1 不演示）
  return false;
}
```

### 3.4 `autoApproved(po, automation)` — 是否被业务层自动同意

```typescript
function autoApproved(po: PurchaseOrder, automation: AutomationBoundary): boolean {
  // 前提 1：必须先未被安全层覆盖
  if (safetyBlocked(po, automation)) return false;

  // ⚠️ 前提 2：效率层金额上限是 PD-3 三层固定优先级的硬性兜底
  // 与 src/lib/skill-runner.ts:266 行为一致 —— 超额订单永远不能自动同意，
  // 即使所有业务规则都触发也必须人工。这是平台对"自动化金额风险"的硬约束，
  // 不能因为 spec 简化而省略。
  if (po.amount > automation.efficiency.autoApproveAmountLimit) return false;

  // 业务层规则 1：延期 ≤ N 天自动同意
  // ⚠️ 重要：此规则只看 supplierDelayReply（事实延期），不看 supplierTier
  if (automation.business.autoApproveIfDelayLE.enabled
      && po.supplierReplyStatus === 'repliedDelay'
      && po.supplierDelayReply !== undefined
      && po.supplierDelayReply <= automation.business.autoApproveIfDelayLE.days) {
    return true;
  }

  // 业务层规则 2：A 级供应商自动同意（默认关闭）
  if (automation.business.autoApproveTierA && po.supplierTier === 'A') {
    // 但 KA 客户必须人工 → 业务层规则 3 覆盖
    if (automation.business.mustHumanIfCustomerKA
        && (po.customerImportance === 'KA' || po.customerImportance === 'strategic')) {
      return false;
    }
    return true;
  }

  return false;
}
```

**关键澄清**：

- 业务层规则 1（延期阈值）**只看 `supplierDelayReply`，不看 `supplierTier`**
- 因此 PO-009（B 级 + 延期 3 天）在阈值=3 时会被自动同意，与等级无关
- 业务层规则 2（A 级自动同意）是**独立的另一条规则**，默认关闭，且会被规则 3（KA 覆盖）压制
- **效率层金额上限是产品判断 PD-3 的效率层兜底，不是工程优化**——超额订单必须人工，无论业务规则是否触发。这与 §1 描述的"安全 > 业务 > 效率"三层固定优先级**不矛盾**：效率层不直接判断"自动同意/人工"，而是为业务层的"自动同意"动作加上一道"金额必须 ≤ 上限"的资格门槛

### 3.5 `sortRank(po)` — 扫描后置顶排序权重

```typescript
function sortRank(po: PurchaseOrder): number {
  // 数字越大越靠前（命中订单内部排序）
  let rank = 0;
  if (po.affectedWorkOrderIds.length > 0) rank += 100;
  if (po.isCritical === 'yes') rank += 50;
  if (po.isSingleSource === 'yes') rank += 30;
  if (po.customerImportance === 'KA') rank += 20;
  if (po.customerImportance === 'strategic') rank += 25;
  rank += (po.followUpCount * 10);
  rank -= po.dueInDays; // 到货越近越靠前
  return rank;
}
```

未命中订单一律排在所有命中订单之后，未命中之间按 `id` 升序排列。

---

## 4. 预期状态矩阵（剧本数字反推依据）

下表是剧本运行 6 步后每条订单的**确定性预期状态**。所有 UI 显示、Trace 日志、复盘统计必须按此表实现。

| ID | `isHit` | `riskLevel` | `safetyBlocked` | Step 3-4 处理（调参前） | Step 5 调参后变化 | 最终复盘归类 |
|----|---------|-------------|-----------------|----------------------|------------------|--------------|
| PO-001 | ✓ | high | ✓ | 待人工（关键件 + 影响在制） | — | 安全层覆盖 → 人工 |
| PO-002 | ✓ | high | ✓ | 待人工（单一来源） | — | 安全层覆盖 → 人工 |
| PO-003 | ✗ | — | — | 未命中（C 级被筛掉） | — | 未命中 |
| PO-004 | ✓ | medium | ✗ | 业务层自动同意（延期 2 ≤ 阈值 2） | 仍自动同意 | 业务层自动 → 任务卡 |
| PO-005 | ✓ | high | ✓ | 待人工（业务层会触发但**被关键件硬规则覆盖**） | — | 安全层覆盖 → 人工 |
| PO-006 | ✗ | — | — | 未命中（dueInDays=14 > 7） | — | 未命中 |
| PO-007 | ✓ | high | ✓ | 待人工（关键件 + 单一来源） | — | 安全层覆盖 → 人工 |
| PO-008 | ✗ | — | — | 未命中（已完结） | — | 未命中 |
| PO-009 | ✓ | medium | ✗ | 待人工（延期 3 > 阈值 2） | **自动同意（3 ≤ 新阈值 3）** | 调参后自动 → 任务卡 |
| PO-010 | ✗ | — | — | 未命中（已回复确认） | — | 未命中 |

### 4.1 剧本关键数字（一表过）

| 指标 | 数值 | 出处 |
|------|------|------|
| 总订单数 | 10 | — |
| 命中数 | **6** | PO-001/002/004/005/007/009 |
| 未命中数 | 4 | PO-003/006/008/010 |
| 高风险数（命中内） | **4** | PO-001/002/005/007 |
| 安全层覆盖数 | **4** | PO-001/002/005/007 |
| 业务层自动同意数（调参前） | **1** | PO-004 |
| 调参后自动同意数（调参引入） | **1** | PO-009 |
| 调参后总自动同意数 | 2 | PO-004 + PO-009 |
| 人工处理数（调参前后不变） | 4 | PO-001/002/005/007 |

**用于剧本文案的标准短语**：

- Step 2 流式输出："命中: **6/10**，其中 **4 条高风险**"
- Step 3 安全层拦截："**4 条订单**触发安全层硬规则"
- Step 5 调参反馈："PO-009 已被纳入自动同意，剧本共 **2 条**自动派发任务卡"
- Step 6 复盘："**10 条订单 → 6 命中 → 4 安全层覆盖人工 / 1 业务层自动 / 1 调参后自动 / 4 未命中**"

### 4.2 金额上限验证（呼应 §3.4 第二道前提）

矩阵里所有"业务层自动同意"和"调参后自动同意"的判定**都已通过 `autoApproveAmountLimit` 默认值 ¥10,000 的门槛**：

| ID | amount | ≤ ¥10,000？ | autoApproved 路径 |
|----|--------|------------|-----------------|
| PO-2025-004 | ¥6,800 | ✓ | 业务层延期阈值通过 → 自动同意 |
| PO-2025-005 | ¥9,500 | ✓ | 业务层延期阈值通过，但被安全层覆盖 → 人工（amount 检查通过不影响最终结果） |
| PO-2025-009 | ¥8,200 | ✓ | 调参前阈值不通过（3 > 2），调参后通过 → 自动同意 |

**反向验证**：如果把 `autoApproveAmountLimit` 调到 ¥5,000，矩阵会变化：

- PO-004（¥6800）→ 调参前后均改为待人工（amount 超额）
- PO-009（¥8200）→ 即使调参后阈值过了仍待人工（amount 超额）
- 总自动同意数从 2 跌到 0

这条反向验证可以作为 Phase 2 实现完成后的**自检 case**——把 `autoApproveAmountLimit` 从 ¥10000 改为 ¥5000，重跑剧本看是否得到上述预期变化。如果没变化，说明实现里漏了金额上限检查（重蹈 C5 覆辙）。

---

## 5. 剧本运行时的配置覆盖（不动 default）

**⚠️ 设计取舍**（Codex 第四轮 4-C2 修复）：早期版本曾建议改 `src/lib/skill-defaults.ts` 把 `replyStatus` 扩展为 `['notReplied', 'repliedDelay']`、`delayRateThreshold` 改为 0——但 `defaultSkillConfig` 是**应用全局初始值 + reset target**，影响所有 Skill Builder 用户的开箱体验。让"演示需求" 反向污染 default 是平台 PM 视角的错误：

- 改 default 后，普通 ISV 打开 Skill Builder 会看到"广撒网式筛选"作为默认，而不是"精准跟催未回复 + 高延期率"
- 这破坏了 Skill Builder 的"开箱即用"承诺——剧本只是一个 demo 场景，不应该决定所有用户的默认体验

### 5.1 正确方案：Agent Console 启动剧本时由 scenario-store 覆盖

剧本启动时由 `scenario-store` 在 `scenarioConfigOverride` 字段计算一次配置覆盖，整个剧本运行期间作为**只读 merge layer** 叠加在 `defaultSkillConfig` 之上：

```typescript
// src/stores/scenario-store.ts （Phase 2 实现）
interface ScenarioState {
  // ... 其他字段（见 agent_console_spec §11.1）

  /** 剧本级配置覆盖，启动时计算，运行期间只读 */
  scenarioConfigOverride: ScenarioConfigOverride;
}

interface ScenarioConfigOverride {
  filter: {
    supplier: {
      replyStatus: ['notReplied', 'repliedDelay'];
      delayRateThreshold: 0;  // 关闭过滤
    };
  };
}
```

剧本期间所有规则判断都用"effective config" = `defaultSkillConfig` deep-merge `scenarioConfigOverride`：

```typescript
const effectiveConfig = deepMerge(defaultSkillConfig, scenarioState.scenarioConfigOverride);
const hits = MOCK_PURCHASE_ORDERS.filter(po => isHit(po, effectiveConfig.filter));
```

### 5.2 启动时写一条 ConfigChangeTrace

`scenario-store` 启动剧本时立刻写一条 trace 标记这个覆盖动作，让 Debug & Eval Tab 可见：

```typescript
{
  type: 'config-change',
  step: 1,
  scope: 'scenario',  // 不是 thisRunOnly 也不是 persist，是新增的剧本级 scope
  changes: scenarioConfigOverride,
  reason: 'scenario-broaden-filter-for-demo',
  affectedOrderIds: ['PO-2025-004', 'PO-2025-005', 'PO-2025-009'],  // 因覆盖而被纳入命中的订单
}
```

`scope: 'scenario'` 是 `agent_console_spec.md` §10.1 新增的 enum 值（之前只有 `'thisRunOnly' | 'persist'`）。

### 5.3 为什么需要这两处覆盖

1. **`replyStatus` 扩展为 `['notReplied', 'repliedDelay']`**：剧本同时演示"主动跟催未回复订单"和"业务层对已回复延期订单的自动同意"。如果只筛 `notReplied`，PO-004 / PO-005 / PO-009 都不会被命中，业务层规则在剧本里就没有演示对象，§3 的炫点 D7（调参 PO-009 自动同意）失效。

2. **`delayRateThreshold` 关闭（设为 0）**：默认值 0.3 表示"只跟催延期率 ≥ 30% 的供应商"。但剧本里 PO-002(0.22) / PO-004(0.18) / PO-005(0.22) / PO-009(0.25) 的延期率都低于 0.3——如果不关闭这条过滤，命中数从 6 跌到 2（只剩 PO-001 和 PO-007），剧本垮掉。

**为什么不改订单数据让所有命中订单延期率 ≥ 0.3？** 业务上 PO-002 的高风险来自"单一来源"而不是"高延期率"，PO-005 的高风险来自"关键件"——把这些订单的 `supplierDelayRate` 强行拉到 ≥ 0.3 会损失业务真实感（"A 级供应商 + 38% 延期率" 在制造业里几乎是矛盾的设定）。

### 5.4 化缺陷为卖点：演示讲述要点

`scenarioConfigOverride` 这一层不仅是工程上的解耦，也是面试演示时的"卖点"：

> **演示讲述话术**（在 Step 1 触发后可以加一句）："你注意到我没有手动调筛选规则——Agent 启动剧本前**自动判断了演示场景的特点**（要演示业务层自动同意），动态扩展了 `replyStatus` 范围、关闭了延期率过滤。这条覆盖动作在 Trace 里全程可见，演示完后我可以点开 Debug & Eval Tab 给你看。"
>
> 这把"为了 demo 不得不改配置"的妥协，包装成了"Agent 根据场景动态调整筛选规则"的产品能力——是 PD-7 决策透明的延伸。

### 5.5 何时该改 default

只有当**所有真实用户都该体验这个改动**时才改 default。例如：

- 如果产品调研显示 80% 的 ISV 实际需要的是"包含已回复延期"的筛选——这时应该改 default，并加 migration notes
- 但仅为 demo 跑通而改 default，是工程便利凌驾于产品判断之上，错误

本节的覆盖方案让 default 保持原样，让 demo 自洽，让 Skill Builder 用户开箱体验不受污染——这是平台 PM 视角的正确切分。

---

## 6. 与 Skill Builder 的呼应

本 schema 锁定的是**剧本运行所需的最小订单形态**。Skill Builder 配置的所有规则都必须能在这 10 条上得到确定的判定结果，否则即可视为**Skill Builder 配置项与 Mock 数据脱节**，需修复。

**反向校验清单**（实现 Phase 2 前自检）：

- [ ] 改 `filter.material.isCritical` 从 `any` 到 `yes` → 命中数从 6 降到 4（PO-001/002/005/007）
- [ ] 改 `filter.impact.affectsCustomerOrder` 从 `false` 到 `true` → 命中数仅剩 1（PO-002）
- [ ] 关闭 `automationBoundary.business.autoApproveIfDelayLE.enabled` → 调参前自动同意数从 1 变 0
- [ ] 关闭 `automationBoundary.safety.critical` → ⚠️ UI 应阻止（PD-3 安全层锁定）

---

**文档版本**：v1.0
**最后更新**：2026-05-14
**关联实现**：`src/mocks/purchase-orders.ts` / `src/lib/skill-runner.ts` / `src/types/mock-data.ts`
