import { Check, UserCog, SkipForward } from 'lucide-react';

import { MOCK_MEMORY_ENTRIES } from '@/mocks/cot-traces';
import type { HumanDecisionKind, OrderRuntimeRow } from '@/types/agent';
import type { PurchaseOrder } from '@/types/mock-data';
import { Button } from '@/components/ui/button';

interface HumanDecisionDrawerProps {
  order: PurchaseOrder;
  row: OrderRuntimeRow;
  onDecide: (decision: HumanDecisionKind) => void;
  shortageHint?: string;
}

/**
 * PD-8 落点：「待人工」按钮展开的内嵌侧栏（不弹模态）。
 * agent_console_spec.md §8.2。
 */
export function HumanDecisionDrawer({
  order,
  row,
  onDecide,
  shortageHint,
}: HumanDecisionDrawerProps) {
  // 取一条历史决策作为 Memory 提示（mock）
  const memoryHint = MOCK_MEMORY_ENTRIES[0];

  return (
    <div className="border-l-2 border-warning bg-warning/5 px-6 py-4">
      <div className="mb-3 text-[11px] font-semibold text-text">
        人工决策面板 · {order.id}
      </div>

      <div className="mb-3 space-y-1.5 text-[11px]">
        <div className="text-muted">当前情况</div>
        {row.safetyTag && (
          <div className="text-text">• {row.safetyTag}</div>
        )}
        {order.affectedWorkOrderIds.length > 0 && (
          <div className="text-text">
            • 影响 {order.affectedWorkOrderIds.length} 张在制工单（
            {order.affectedWorkOrderIds.join('、')}）
          </div>
        )}
        {shortageHint && (
          <div className="text-text">• 齐套预警：{shortageHint}</div>
        )}
      </div>

      <div className="mb-3 space-y-1 text-[11px]">
        <div className="text-muted">Memory 提示</div>
        <div className="text-text">
          • {memoryHint?.date} {memoryHint?.summary}（{memoryHint?.order}）
          上次选择「{memoryHint?.decision}」
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={() => onDecide('dispatchToManager')}
          className="bg-success border-success hover:brightness-110"
        >
          <Check className="h-3 w-3" />
          同意派发
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => onDecide('reassignManual')}
        >
          <UserCog className="h-3 w-3" />
          改派人工
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDecide('skip')}
        >
          <SkipForward className="h-3 w-3" />
          跳过本次
        </Button>
      </div>
    </div>
  );
}
