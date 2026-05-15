import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, TableProperties } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HumanDecisionDrawer } from '@/components/agent-console/human-decision-drawer';
import { MOCK_COMPLETENESS_ALERT_RESPONSE } from '@/mocks/cot-traces';
import { MOCK_PURCHASE_ORDERS } from '@/mocks/purchase-orders';
import { TIMINGS } from '@/lib/scenario-timings';
import { useScenarioStore } from '@/stores/scenario-store';
import { cn } from '@/lib/utils';
import { SCENARIO_STEP_INDEX, type OrderRuntimeRow } from '@/types/agent';
import type { PurchaseOrder } from '@/types/mock-data';

const ORDERS_ARRAY = Object.values(MOCK_PURCHASE_ORDERS);

/** mock_data_schema §3.5：命中订单内部按 rank 排序，未命中按 id 升序排末尾 */
function sortRank(po: PurchaseOrder): number {
  let rank = 0;
  if (po.affectedWorkOrderIds.length > 0) rank += 100;
  if (po.isCritical === 'yes') rank += 50;
  if (po.isSingleSource === 'yes') rank += 30;
  if (po.customerImportance === 'KA') rank += 20;
  if (po.customerImportance === 'strategic') rank += 25;
  rank += po.followUpCount * 10;
  rank -= po.dueInDays;
  return rank;
}

export function OrderTable() {
  const currentStep = useScenarioStore((s) => s.currentStep);
  const runtimeRows = useScenarioStore((s) => s.runtimeRows);
  const submitHumanDecision = useScenarioStore((s) => s.submitHumanDecision);
  const highlightedOrderId = useScenarioStore((s) => s.highlightedOrderId);

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // D3 扫描动画：currentStep 第一次跨入 'scanning' 时启动一次
  // scanRowIndex = -1：未开始；0..9：当前扫到第 N 行；10：扫完
  const [scanRowIndex, setScanRowIndex] = useState(-1);

  // effect 只依赖 currentStep —— 不依赖 scanRowIndex，避免 setState→effect 自循环
  useEffect(() => {
    if (currentStep === 'idle' || currentStep === 'trigger') {
      setScanRowIndex(-1);
      return;
    }
    if (currentStep === 'scanning') {
      let i = 0;
      setScanRowIndex(0);
      const interval = window.setInterval(() => {
        i += 1;
        if (i >= ORDERS_ARRAY.length) {
          setScanRowIndex(ORDERS_ARRAY.length);
          window.clearInterval(interval);
        } else {
          setScanRowIndex(i);
        }
      }, TIMINGS.scanRowDelay);
      return () => window.clearInterval(interval);
    }
    // 进入 'safety-block' 等后续步骤：动画一律视为完成（跳到终态）
    setScanRowIndex(ORDERS_ARRAY.length);
    return;
  }, [currentStep]);

  const stepIndex = SCENARIO_STEP_INDEX[currentStep];
  // 扫描动画完成后再置顶排序（避免动画期间订单跳来跳去）
  const scanCompleted = scanRowIndex >= ORDERS_ARRAY.length;
  const sortApplied = stepIndex >= 2 && (stepIndex > 2 || scanCompleted);

  const sortedOrders = useMemo(() => {
    if (!sortApplied) return ORDERS_ARRAY;
    return [...ORDERS_ARRAY].sort((a, b) => {
      const ra = runtimeRows[a.id];
      const rb = runtimeRows[b.id];
      const aMissed = ra?.status === 'missed';
      const bMissed = rb?.status === 'missed';
      if (aMissed !== bMissed) return aMissed ? 1 : -1;
      if (aMissed && bMissed) return a.id.localeCompare(b.id);
      return sortRank(b) - sortRank(a);
    });
  }, [sortApplied, runtimeRows]);

  // 扫描动画时：scanRowIndex 表示当前光带所在的"原始插入顺序"位置
  const orderIdAtScanRow =
    scanRowIndex >= 0 && scanRowIndex < ORDERS_ARRAY.length
      ? ORDERS_ARRAY[scanRowIndex]?.id ?? null
      : null;

  const groupedSummary = useMemo(() => {
    const summary = { hit: 0, missed: 0, pendingHuman: 0, autoApproved: 0, humanResolved: 0 };
    for (const row of Object.values(runtimeRows)) {
      if (row.status === 'hit') summary.hit += 1;
      else if (row.status === 'missed') summary.missed += 1;
      else if (row.status === 'pendingHuman') summary.pendingHuman += 1;
      else if (row.status === 'autoApproved') summary.autoApproved += 1;
      else if (row.status === 'humanResolved') summary.humanResolved += 1;
    }
    return summary;
  }, [runtimeRows]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <div className="flex items-center gap-1.5">
          <TableProperties className="h-3.5 w-3.5 text-muted" />
          <h3 className="text-[13px] font-semibold">订单表</h3>
          <span className="text-[11px] text-muted">10 条 mock 采购订单</span>
        </div>
        {stepIndex >= 2 && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <Badge tone="primary">命中 {groupedSummary.hit + groupedSummary.pendingHuman + groupedSummary.autoApproved + groupedSummary.humanResolved}</Badge>
            {groupedSummary.pendingHuman > 0 && (
              <Badge tone="warning">待人工 {groupedSummary.pendingHuman}</Badge>
            )}
            {groupedSummary.autoApproved > 0 && (
              <Badge tone="success">自动同意 {groupedSummary.autoApproved}</Badge>
            )}
            {groupedSummary.humanResolved > 0 && (
              <Badge tone="default">已处理 {groupedSummary.humanResolved}</Badge>
            )}
            <Badge tone="default">未命中 {groupedSummary.missed}</Badge>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-[12px] tabular-nums">
          <thead className="sticky top-0 z-10 bg-bg text-[11px] text-muted">
            <tr className="border-b border-border">
              <th className="w-1 p-0" aria-label="状态条" />
              <th className="px-3 py-2 text-left font-medium">订单号</th>
              <th className="px-3 py-2 text-left font-medium">物料</th>
              <th className="px-3 py-2 text-right font-medium">数量/金额</th>
              <th className="px-3 py-2 text-left font-medium">供应商</th>
              <th className="px-3 py-2 text-left font-medium">到货</th>
              <th className="px-3 py-2 text-left font-medium">回复</th>
              <th className="px-3 py-2 text-left font-medium">风险标签</th>
              <th className="px-3 py-2 text-left font-medium">处理状态</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map((order) => {
              const row = runtimeRows[order.id];
              if (!row) return null;
              const isExpanded = expandedRowId === order.id;
              const isBeingScanned = orderIdAtScanRow === order.id;
              const isHighlighted = highlightedOrderId === order.id;
              return (
                <OrderRow
                  key={order.id}
                  order={order}
                  row={row}
                  isExpanded={isExpanded}
                  isBeingScanned={isBeingScanned}
                  isHighlighted={isHighlighted}
                  onToggleExpand={() =>
                    setExpandedRowId(isExpanded ? null : order.id)
                  }
                  onDecide={(decision) => {
                    submitHumanDecision(order.id, decision);
                    setExpandedRowId(null);
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface OrderRowProps {
  order: PurchaseOrder;
  row: OrderRuntimeRow;
  isExpanded: boolean;
  isBeingScanned: boolean;
  isHighlighted: boolean;
  onToggleExpand: () => void;
  onDecide: (decision: 'dispatchToManager' | 'reassignManual' | 'skip') => void;
}

function OrderRow({
  order,
  row,
  isExpanded,
  isBeingScanned,
  isHighlighted,
  onToggleExpand,
  onDecide,
}: OrderRowProps) {
  // 跨 Tab 高亮：被 DE 跳过来时滚到视图 + 闪烁
  const rowRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (isHighlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);
  const isMissed = row.status === 'missed';
  const isPending = row.status === 'pendingHuman';
  const isAuto = row.status === 'autoApproved';
  const isResolved = row.status === 'humanResolved';
  const isHit = row.status === 'hit';

  // 状态条颜色（spec §5.1）
  const statusBarClass = cn(
    'w-1 transition-colors',
    isPending && 'bg-warning',
    isAuto && 'bg-success',
    isResolved && 'bg-muted',
    isHit && 'bg-accent',
    isMissed && 'bg-border',
    row.status === 'idle' && 'bg-transparent',
  );

  return (
    <>
      <tr
        ref={rowRef}
        className={cn(
          'border-b border-border transition-opacity',
          isMissed && 'opacity-60',
          (isPending || isAuto || isResolved) && 'bg-bg/40',
          isBeingScanned && 'bg-accent/15 ring-1 ring-accent/30 ring-inset',
          isHighlighted && 'bg-accent/10 ring-2 ring-accent animate-pulse',
        )}
      >
        <td className={cn('p-0', statusBarClass)} />
        <td className="px-3 py-2.5 font-mono text-[11px] font-medium">
          {order.id}
        </td>
        <td className="px-3 py-2.5">
          <div className="font-mono text-[10px] text-muted">{order.materialCode}</div>
          <div className="text-[12px]">{order.materialName}</div>
        </td>
        <td className="px-3 py-2.5 text-right">
          <div>{order.quantity.toLocaleString()}</div>
          <div className="text-[11px] text-muted">¥{order.amount.toLocaleString()}</div>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px]">{order.supplierName}</span>
            <SupplierTierBadge tier={order.supplierTier} />
          </div>
          <div className="text-[10px] text-muted">
            延期率 {(order.supplierDelayRate * 100).toFixed(0)}%
          </div>
        </td>
        <td className="px-3 py-2.5">
          <DueChip dueInDays={order.dueInDays} />
        </td>
        <td className="px-3 py-2.5">
          <ReplyChip
            status={order.supplierReplyStatus}
            delayDays={order.supplierDelayReply}
          />
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap gap-1">
            {order.isCritical === 'yes' && <Badge tone="danger">关键件</Badge>}
            {order.isSingleSource === 'yes' && <Badge tone="warning">单一来源</Badge>}
            {order.affectedWorkOrderIds.length > 0 && (
              <Badge tone="warning">
                影响 {order.affectedWorkOrderIds.length} 张工单
              </Badge>
            )}
            {order.customerImportance === 'KA' && <Badge tone="danger">KA 客户</Badge>}
            {order.customerImportance === 'strategic' && (
              <Badge tone="danger">战略客户</Badge>
            )}
            {order.followUpCount >= 2 && (
              <Badge tone="default">已跟催 {order.followUpCount} 次</Badge>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5">
          <StatusChip row={row} />
        </td>
        <td className="px-3 py-2.5">
          {isPending && (
            <Button
              size="sm"
              variant="primary"
              onClick={onToggleExpand}
              data-cursor-target={`po-action-${order.id}`}
            >
              {isExpanded ? (
                <>
                  收起
                  <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  待人工
                  <ChevronDown className="h-3 w-3" />
                </>
              )}
            </Button>
          )}
          {isResolved && (
            <span className="text-[11px] text-muted">已处理</span>
          )}
        </td>
      </tr>

      {isExpanded && isPending && (
        <tr>
          <td colSpan={10} className="p-0">
            <HumanDecisionDrawer
              order={order}
              row={row}
              onDecide={onDecide}
              shortageHint={
                order.affectedWorkOrderIds.length > 0
                  ? `缺料 ${MOCK_COMPLETENESS_ALERT_RESPONSE.shortageCount} 项 · 置信度 ${(MOCK_COMPLETENESS_ALERT_RESPONSE.confidence * 100).toFixed(0)}%`
                  : undefined
              }
            />
          </td>
        </tr>
      )}
    </>
  );
}

function SupplierTierBadge({ tier }: { tier: 'A' | 'B' | 'C' }) {
  const tone = tier === 'A' ? 'success' : tier === 'B' ? 'primary' : 'default';
  return <Badge tone={tone}>{tier} 级</Badge>;
}

function DueChip({ dueInDays }: { dueInDays: number }) {
  if (dueInDays < 0) {
    return (
      <span className="text-[12px] text-danger">已逾期 {-dueInDays} 天</span>
    );
  }
  const tone = dueInDays <= 3 ? 'text-warning' : 'text-text';
  return <span className={cn('text-[12px]', tone)}>{dueInDays} 天后</span>;
}

function ReplyChip({
  status,
  delayDays,
}: {
  status: 'notReplied' | 'repliedDelay' | 'repliedConfirm';
  delayDays?: number;
}) {
  if (status === 'notReplied')
    return <Badge tone="default">未回复</Badge>;
  if (status === 'repliedConfirm')
    return <Badge tone="success">已确认</Badge>;
  return <Badge tone="warning">回复延期 {delayDays ?? '?'} 天</Badge>;
}

function StatusChip({ row }: { row: OrderRuntimeRow }) {
  if (row.status === 'idle')
    return <span className="text-[11px] text-muted">—</span>;
  if (row.status === 'hit')
    return <Badge tone="accent">命中</Badge>;
  if (row.status === 'missed')
    return (
      <div className="text-[11px] text-muted">
        <div>未命中</div>
        {row.missedReason && (
          <div className="mt-0.5 max-w-[180px] text-[10px]">{row.missedReason}</div>
        )}
      </div>
    );
  if (row.status === 'pendingHuman')
    return (
      <div className="text-[11px]">
        <Badge tone="warning">待人工</Badge>
        {row.safetyTag && (
          <div className="mt-0.5 max-w-[180px] text-[10px] text-muted">
            {row.safetyTag}
          </div>
        )}
      </div>
    );
  if (row.status === 'autoApproved')
    return (
      <div className="text-[11px]">
        <Badge tone="success">已自动同意</Badge>
        {row.autoApprovedReason && (
          <div className="mt-0.5 max-w-[180px] text-[10px] text-muted">
            {row.autoApprovedReason}
          </div>
        )}
      </div>
    );
  if (row.status === 'humanResolved') {
    const decisionLabel: Record<string, string> = {
      dispatchToManager: '已派发主管',
      reassignManual: '已改派人工',
      skip: '已跳过',
    };
    return (
      <Badge tone="default">
        {row.humanDecision ? decisionLabel[row.humanDecision] ?? '已处理' : '已处理'}
      </Badge>
    );
  }
  return null;
}
