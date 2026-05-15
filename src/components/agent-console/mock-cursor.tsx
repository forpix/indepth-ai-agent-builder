import { useScenarioStore } from '@/stores/scenario-store';

/**
 * X1 演示模式专用：浮在屏幕上的伪鼠标光标（不是真实系统光标）。
 * agent_console_spec.md §9.1.1 ——「观众看到光标移过去，按钮被点了」是 PD-8 的视觉证据。
 *
 * 位置来自 useScenarioStore.mockCursor。null = 不显示。
 * CSS transition 平滑滑动到目标按钮坐标（300ms）。
 */
export function MockCursor() {
  const cursor = useScenarioStore((s) => s.mockCursor);

  if (!cursor) return null;

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: cursor.x - 8,
        top: cursor.y - 4,
        transition: 'left 300ms cubic-bezier(0.4, 0, 0.2, 1), top 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      aria-hidden
    >
      <svg width="22" height="24" viewBox="0 0 22 24" fill="none">
        {/* 鼠标箭头形状 + 投影 */}
        <defs>
          <filter id="mockCursorShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodOpacity="0.35" />
          </filter>
        </defs>
        <path
          d="M2 1 L2 18 L7 14 L10 22 L13 21 L10 13 L17 13 Z"
          fill="white"
          stroke="rgb(14, 165, 233)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          filter="url(#mockCursorShadow)"
        />
      </svg>
      {cursor.hint && (
        <div className="absolute left-6 top-5 whitespace-nowrap rounded-md bg-accent px-2 py-0.5 text-[10px] text-white shadow">
          {cursor.hint}
        </div>
      )}
    </div>
  );
}
