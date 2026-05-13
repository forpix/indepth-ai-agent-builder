import type { DemoScenario } from '@/types/mock-data';

import { MOCK_PURCHASE_ORDERS as O } from './purchase-orders';

/**
 * 3 个预置场景（决策 H）—— 模拟运行抽屉里的演示输入。
 *
 *   A 综合场景：5 条订单 / 3 条未回复 / 1 条关键件 / 2 张在制工单
 *   B 普通场景：4 条订单 / 全未回复 / 无关键件 / 无在制工单
 *   C 高风险场景：2 条订单 / 已二次跟催 / 单一来源 / 影响 KA 客户订单
 *
 * narrative 是 D-3 只展示不解析的文本框内容。
 */
export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'A',
    title: '场景 A · 综合：5 条订单',
    narrative:
      '昨日导入了 5 条采购单：3 条供应商未回复（其中 1 条是关键件、影响 2 张在制工单），1 条已回复延期 2 天，1 条已回复确认。请按当前 Skill 配置评估。',
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
      '未来 7 天内到货的 4 条订单，供应商均未回复。无关键件、无单一来源、不影响在制工单。请用最经济的方式驱动跟催。',
    orders: [
      O['PO-2025-003']!,
      // 复用 PO-005 但视为"未回复"——为了让场景 B 全部未回复
      { ...O['PO-2025-005']!, supplierReplyStatus: 'notReplied' },
      // 再造 2 条同类普通订单
      {
        ...O['PO-2025-003']!,
        id: 'PO-2025-006',
        materialCode: 'STL-PL-Q235-3MM',
        materialName: 'Q235 钢板 3mm',
        quantity: 50,
        amount: 12400,
        supplierName: '宁波兴泰钢材',
        supplierId: 'SUP-B2204',
        dueInDays: 5,
      },
      {
        ...O['PO-2025-003']!,
        id: 'PO-2025-007',
        materialCode: 'PNT-IND-WHITE-20L',
        materialName: '工业漆白色 20L',
        quantity: 30,
        amount: 5600,
        supplierName: '常州东方涂料',
        supplierId: 'SUP-C0311',
        supplierTier: 'C',
        dueInDays: 7,
      },
    ],
  },
  {
    id: 'C',
    title: '场景 C · 高风险：2 条已二次跟催未回复',
    narrative:
      '2 条单一来源 / 关键件订单已经做过二次跟催仍未回复，其中 1 条影响 KA 客户订单 SO-2025-A077。需要按安全层强制人工。',
    orders: [
      O['PO-2025-002']!,
      // 第 2 条 mock 单：单一来源、关键件、二次跟催过、未回复
      {
        ...O['PO-2025-001']!,
        id: 'PO-2025-008',
        materialCode: 'BRG-NSK-6210ZZ',
        materialName: 'NSK 深沟球轴承 6210ZZ（进口）',
        quantity: 50,
        amount: 32000,
        supplierId: 'SUP-A0901',
        supplierName: '日本贸易代理（独家）',
        isSingleSource: 'yes',
        hasAlternative: 'no',
        followUpCount: 2,
        affectedWorkOrderIds: ['WO-2025-0420'],
        affectsMRP: true,
        affectedCustomerOrderIds: [],
        customerImportance: 'normal',
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
