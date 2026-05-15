import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { MOCK_COMPLETENESS_ALERT_RESPONSE } from '@/mocks/cot-traces';
import { TIMINGS } from '@/lib/scenario-timings';
import { useScenarioStore } from '@/stores/scenario-store';

type BallPhase = 'idle' | 'forward' | 'pause' | 'backward' | 'done';

/**
 * D6 多智能体协作图 ——
 * 主 Skill（采购跟催）→ 调用 → 子 Skill（齐套预警）→ 返回结果。
 *
 * 当 currentStep 第一次进入 'safety-block' 时触发：
 *   forward (500ms)  → pause (300ms) → backward (500ms) → done
 * Fallback：动画跑完 / 重置后渲染静态终态（spec §11.4）。
 */
export function MultiAgentDiagram() {
  const currentStep = useScenarioStore((s) => s.currentStep);
  const [phase, setPhase] = useState<BallPhase>('idle');

  // 只依赖 currentStep —— phase 是内部播放进度，不应触发 effect 重跑
  useEffect(() => {
    if (currentStep === 'idle' || currentStep === 'trigger' || currentStep === 'scanning') {
      setPhase('idle');
      return;
    }
    if (currentStep === 'safety-block') {
      setPhase('forward');
      const t1 = window.setTimeout(
        () => setPhase('pause'),
        TIMINGS.callSkillBall,
      );
      const t2 = window.setTimeout(
        () => setPhase('backward'),
        TIMINGS.callSkillBall + 300,
      );
      const t3 = window.setTimeout(
        () => setPhase('done'),
        TIMINGS.callSkillBall * 2 + 300,
      );
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.clearTimeout(t3);
      };
    }
    // 进入 user-question 及之后：动画保持终态
    setPhase('done');
    return;
  }, [currentStep]);

  // 主 Skill 圈 cx=40, 子 Skill 圈 cx=180, y=36, r=20
  // 球 r=5，从 60→160 (forward) / 160→60 (backward)
  const ballCx =
    phase === 'forward' || phase === 'pause'
      ? 160
      : phase === 'backward'
      ? 60
      : phase === 'done'
      ? 60
      : null;

  const subStatusText =
    phase === 'idle'
      ? '待命'
      : phase === 'forward'
      ? '请求中...'
      : phase === 'pause'
      ? '处理中...'
      : phase === 'backward'
      ? '返回结果'
      : '已完成';

  return (
    <div className="rounded-md border border-accent/20 bg-accent/5 p-3 text-[11px]">
      <div className="mb-2 flex items-center gap-1.5">
        <Badge tone="accent">主</Badge>
        <span className="text-text">采购跟催</span>
        <span className="text-muted">↔</span>
        <Badge tone="primary">子</Badge>
        <span className="text-text">齐套预警</span>
      </div>

      <svg
        viewBox="0 0 220 72"
        className="w-full"
        role="img"
        aria-label="多智能体协作图"
      >
        {/* 连接线 */}
        <line
          x1="60"
          y1="36"
          x2="160"
          y2="36"
          stroke="rgb(148 163 184)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        {/* 主 Skill 圆 */}
        <circle cx="40" cy="36" r="20" fill="rgba(14, 165, 233, 0.12)" stroke="rgb(14, 165, 233)" strokeWidth="1.5" />
        <text x="40" y="40" textAnchor="middle" fontSize="9" fill="rgb(14, 165, 233)" fontWeight="600">主</text>
        {/* 子 Skill 圆 */}
        <circle cx="180" cy="36" r="20" fill="rgba(59, 92, 126, 0.12)" stroke="rgb(59, 92, 126)" strokeWidth="1.5" />
        <text x="180" y="40" textAnchor="middle" fontSize="9" fill="rgb(59, 92, 126)" fontWeight="600">子</text>

        {/* 飞行小球（仅在动画期间显示） */}
        {ballCx !== null && phase !== 'done' && (
          <circle
            cx={ballCx}
            cy="36"
            r="5"
            fill={phase === 'forward' || phase === 'pause' ? 'rgb(14, 165, 233)' : 'rgb(16, 185, 129)'}
            style={{
              transition: `cx ${TIMINGS.callSkillBall}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
          />
        )}
      </svg>

      <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
        <span>采购跟催 · 等待返回</span>
        <span>齐套预警 · {subStatusText}</span>
      </div>

      {(phase === 'done' || phase === 'backward') && (
        <div className="mt-2 rounded-md border border-success/30 bg-success/5 px-2 py-1.5 text-[10px] text-text">
          ✓ 子 Skill 返回：缺料{' '}
          <span className="font-mono">
            {MOCK_COMPLETENESS_ALERT_RESPONSE.shortageCount}
          </span>{' '}
          项 · 置信度{' '}
          <span className="font-mono">
            {(MOCK_COMPLETENESS_ALERT_RESPONSE.confidence * 100).toFixed(0)}%
          </span>
          ，影响工单{' '}
          {MOCK_COMPLETENESS_ALERT_RESPONSE.affectedWorkOrderIds.join('、')}，
          建议人工介入。
        </div>
      )}
    </div>
  );
}
