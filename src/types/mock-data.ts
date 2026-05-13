/**
 * Mock 数据 schema —— 模拟运行用的最小订单结构。
 * 字段命名遵循 CLAUDE.md §8.2 的"制造业风格"：工业级编码 + 真实业务术语。
 */

import type { SupplierReplyStatus, SupplierTier } from './skill';

export interface PurchaseOrder {
  /** 采购单号，形如 PO-2025-001 */
  id: string;
  /** 物料编码，形如 FAS-M8-A270-001（紧固件-M8 规格-A2-70 材质-序号） */
  materialCode: string;
  /** 物料中文名 */
  materialName: string;
  /** 数量 */
  quantity: number;
  /** 总金额（元） */
  amount: number;
  /** 供应商 ID */
  supplierId: string;
  /** 供应商名 */
  supplierName: string;
  /** 供应商等级 */
  supplierTier: SupplierTier;
  /** 该供应商近 90 天历史延期率（0-1） */
  supplierDelayRate: number;
  /** 距离预计到货日还有多少天（负数表示已到期） */
  dueInDays: number;
  /** 是否已完结 */
  completed: boolean;
  /** 供应商是否已回复 */
  supplierReplyStatus: SupplierReplyStatus;
  /** 若 supplierReplyStatus = repliedDelay，回复的延期天数 */
  supplierDelayReply?: number;
  /** 物料属性（订单上是确定值，没有"不限"） */
  isCritical: 'yes' | 'no';
  isSingleSource: 'yes' | 'no';
  hasAlternative: 'yes' | 'no';
  /** 影响范围 */
  affectedWorkOrderIds: string[];
  affectsMRP: boolean;
  affectedCustomerOrderIds: string[];
  /** 影响客户中是否包含 KA / 战略 */
  customerImportance: 'normal' | 'KA' | 'strategic';
  /** 已经做过几次跟催 */
  followUpCount: number;
}

/**
 * 演示场景 —— 一组采购单 + 一段描述。
 * 决策 H：3 个预置场景 A / B / C。
 */
export interface DemoScenario {
  id: 'A' | 'B' | 'C';
  title: string;
  narrative: string;
  orders: PurchaseOrder[];
}
