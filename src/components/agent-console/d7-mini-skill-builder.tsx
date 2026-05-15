import { useEffect, useState } from 'react';
import { Settings2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { defaultSkillConfig } from '@/lib/skill-defaults';
import { useScenarioStore } from '@/stores/scenario-store';
import { cn } from '@/lib/utils';

/**
 * D7 炫点 —— 屏幕中央浮起的迷你 Skill Builder 卡。
 * 仅显示当前剧本相关的 1 个配置项：业务层「延期天数 ≤ N 自动同意」。
 *
 * 不切 Tab、不弹模态——用半透明遮罩 + 中央固定卡片实现"原地浮起"。
 * 详见 agent_console_spec.md §7。
 */
export function D7MiniSkillBuilder() {
  const showD7Card = useScenarioStore((s) => s.showD7Card);
  const closeD7Card = useScenarioStore((s) => s.closeD7Card);
  const applyThisRunOverride = useScenarioStore((s) => s.applyThisRunOverride);
  const thisRunOverride = useScenarioStore((s) => s.thisRunConfigOverride);

  const currentDays =
    thisRunOverride.autoApproveIfDelayDays ??
    defaultSkillConfig.automationBoundary.business.autoApproveIfDelayLE.days;

  const [days, setDays] = useState<number>(currentDays);
  const [persist, setPersist] = useState(false);

  // 卡片打开时重置 slider 到当前值
  useEffect(() => {
    if (showD7Card) {
      setDays(currentDays);
      setPersist(false);
    }
  }, [showD7Card, currentDays]);

  if (!showD7Card) return null;

  // 实时预览：哪些订单会因为新阈值而被纳入自动同意
  // 数据集已固定，硬编码预览逻辑（详见 mock_data_schema §4）：
  //   仅 PO-2025-009（supplierDelayReply=3）在阈值≥3 时翻转
  const affectedOrders: string[] = days >= 3 ? ['PO-2025-009'] : [];

  const handleConfirm = () => {
    applyThisRunOverride(days, persist);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}
    >
      <div className="w-[480px] rounded-lg border border-border bg-surface shadow-2xl">
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-1.5">
            <Settings2 className="h-4 w-4 text-accent" />
            <div>
              <div className="text-[13px] font-semibold text-text">
                临时调整：业务层 · 延期自动同意
              </div>
              <div className="text-[10px] text-muted">
                浮起迷你 Skill Builder（不切 Tab）
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={closeD7Card}
            className="text-muted hover:text-text"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 主体 */}
        <div className="space-y-4 px-5 py-4 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-text">启用业务层「延期自动同意」</span>
            <span className="rounded-md bg-success/10 px-2 py-0.5 text-[10px] text-success">
              开（已启用）
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-text">延期天数 ≤</span>
              <span className="font-mono text-[14px] font-semibold text-accent">
                {days} 天
              </span>
            </div>
            <Slider
              min={2}
              max={7}
              step={1}
              value={[days]}
              onValueChange={(values) => {
                const v = values[0];
                if (typeof v === 'number') setDays(v);
              }}
            />
            <div className="flex justify-between text-[10px] text-muted">
              <span>2 天（当前）</span>
              <span>7 天</span>
            </div>
          </div>

          {/* 实时预览影响 */}
          <div
            className={cn(
              'rounded-md border px-3 py-2.5 text-[11px]',
              affectedOrders.length > 0
                ? 'border-warning/30 bg-warning/5'
                : 'border-border bg-bg/40',
            )}
          >
            <div className="mb-1 flex items-center gap-1 font-medium text-text">
              <span>ℹ 调整后影响（实时预览）</span>
            </div>
            {affectedOrders.length > 0 ? (
              <ul className="ml-3 list-disc space-y-0.5 text-muted">
                {affectedOrders.map((id) => (
                  <li key={id}>
                    <span className="font-mono">{id}</span>（延期 3 天）
                    将被纳入业务层自动同意，自动派发任务卡
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted">无变化（当前阈值就是 2 天）</div>
            )}
          </div>

          {/* 持久化范围 */}
          <div className="space-y-2 rounded-md border border-border bg-bg/40 px-3 py-2.5">
            <label className="flex items-start gap-2">
              <Checkbox
                checked={!persist}
                onCheckedChange={(v) => setPersist(!v)}
                className="mt-0.5"
              />
              <div className="text-[11px]">
                <div className="text-text">仅本次剧本生效</div>
                <div className="text-[10px] text-muted">
                  写 ConfigChangeTrace(scope=&apos;thisRunOnly&apos;)，不污染 Skill 配置
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2">
              <Checkbox
                checked={persist}
                onCheckedChange={(v) => setPersist(Boolean(v))}
                className="mt-0.5"
              />
              <div className="text-[11px]">
                <div className="text-text">永久保存到 Skill 配置</div>
                <div className="text-[10px] text-muted">
                  写 ConfigChangeTrace(scope=&apos;persist&apos;)，Skill Builder 同步更新
                  · 仅 ISV/admin 角色可见（demo 全部 mock 通过）
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" onClick={closeD7Card}>
            取消
          </Button>
          <Button variant="primary" size="md" onClick={handleConfirm}>
            确认并立即生效
          </Button>
        </div>
      </div>
    </div>
  );
}
