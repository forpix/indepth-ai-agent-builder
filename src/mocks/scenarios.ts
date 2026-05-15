import type { DemoScenario } from '@/types/mock-data';

import { MOCK_PURCHASE_ORDERS as O } from './purchase-orders';

/**
 * 3 个预置场景（决策 H）—— 模拟运行抽屉里的演示输入。
 *
 *   A 综合场景：5 条订单 / 3 条未回复 / 1 条关键件影响 2 张工单 / 2 条已回复延期
 *   B 普通跟催：4 条订单 / 全未回复 / B 级普通件 / 不影响在制工单
 *   C 高风险：2 条订单 / 双重硬规则（关键件 + 单一来源）/ 已二次跟催 / 含 1 条 KA
 *
 * narrative 是 D-3 只展示不解析的文本框内容。
 *
 * 注：合成订单使用 ID 段 PO-2025-1xx，避免与 MOCK_PURCHASE_ORDERS 的 001-010 碰撞。
 */
export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'A',
    title: '场景 A · 综合：5 条订单',
    narrative:
      '导入 5 条采购单：3 条未回复（PO-001 关键件影响 2 张在制工单 / PO-002 单一来源 + KA 客户 / PO-003 通用件 C 级），2 条已回复延期（PO-004 延期 2 天 / PO-005 延期 1 天但是关键件 → 业务层会触发但被安全层覆盖）。请按当前 Skill 配置评估，重点观察 PD-3 三层固定优先级是否正确执行。',
    orders: [
      O['PO-2025-001']!,
      O['PO-2025-002']!,
      O['PO-2025-003']!,
      O['PO-2025-004']!,
      O['PO-2025-005']!,
    ],
  },
  {
    id: 'B',
    title: '场景 B · 普通跟催：4 条订单',
    narrative:
      '未来 7 天内到货的 4 条 B 级供应商通用件订单，全部未回复。无关键件、无单一来源、不影响在制工单。延期率均在阈值之上（默认 30%），但业务层默认不放行自动同意——演示"安全 0、自动 0、人工 4"的"保守默认"剧情。',
    orders: [
      // 真实 PO-003 是 C 级 + 延期率 0.15。这里 override 成 B 级 + 0.32（略高于默认阈值 0.3）
      // 以保证默认 Skill 配置下也能命中、展示完整 4 条人工复核链路
      { ...O['PO-2025-003']!, supplierTier: 'B', supplierDelayRate: 0.32 },
      {
        ...O['PO-2025-003']!,
        id: 'PO-2025-101',
        materialCode: 'STL-PL-Q235-3MM',
        materialName: 'Q235 钢板 3mm',
        quantity: 50,
        amount: 12400,
        supplierName: '宁波兴泰钢材',
        supplierId: 'SUP-B2204',
        supplierTier: 'B',
        supplierDelayRate: 0.34,
        dueInDays: 5,
      },
      {
        ...O['PO-2025-003']!,
        id: 'PO-2025-102',
        materialCode: 'PNT-IND-WHITE-20L',
        materialName: '工业漆白色 20L',
        quantity: 30,
        amount: 5600,
        supplierName: '常州东方涂料',
        supplierId: 'SUP-B0311',
        supplierTier: 'B',
        supplierDelayRate: 0.31,
        dueInDays: 7,
      },
      {
        ...O['PO-2025-003']!,
        id: 'PO-2025-103',
        materialCode: 'PCK-CTN-A4',
        materialName: '中转纸箱 A4',
        quantity: 2000,
        amount: 5200,
        supplierName: '昆山包装材料',
        supplierId: 'SUP-B0904',
        supplierTier: 'B',
        supplierDelayRate: 0.33,
        dueInDays: 6,
      },
    ],
  },
  {
    id: 'C',
    title: '场景 C · 高风险：2 条已二次跟催未回复',
    narrative:
      '2 条「关键件 + 单一来源」订单已经做过二次跟催仍未回复（PO-002 影响 KA 客户订单 SO-2025-A077，单一来源 + 1 张在制工单；PO-2025-104 是另一条单一来源关键件 + 影响 MRP）。请按安全层硬规则强制人工，并联动齐套预警 / 异常工单升级。',
    orders: [
      O['PO-2025-002']!,
      // 合成订单：从真实 PO-007（铝合金型材：关键件 + 单一来源 + 1 张在制工单 + followUp=1）
      // 派生为"已二次跟催"版本，匹配 narrative
      {
        ...O['PO-2025-007']!,
        id: 'PO-2025-104',
        materialCode: 'BRG-NSK-6210ZZ',
        materialName: 'NSK 深沟球轴承 6210ZZ（进口）',
        quantity: 50,
        amount: 32000,
        supplierId: 'SUP-A0901',
        supplierName: '日本贸易代理（独家）',
        followUpCount: 2,
        affectsMRP: true,
        dueInDays: 4,
      },
    ],
  },
];

export function getScenario(id: 'A' | 'B' | 'C'): DemoScenario {
  const s = DEMO_SCENARIOS.find((sc) => sc.id === id);
  if (!s) throw new Error(`Scenario ${id} not found`);
  return s;
}
