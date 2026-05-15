/**
 * Agent Console 剧本动画时序常量 —— 集中在此处，组件不直接写 magic number。
 * 详见 agent_console_spec.md §11.2。
 */
export const TIMINGS = {
  /** 扫描每行高亮停留（ms），D3 用 */
  scanRowDelay: 300,
  /** 默认流式打字速度（字符/秒） */
  typingSpeed: 30,
  /** 演示模式提速后的打字速度（字符/秒） */
  typingSpeedFast: 90,
  /** 浮起迷你卡片淡出（ms） */
  cardFadeOut: 300,
  /** 多智能体小球飞行（ms） */
  callSkillBall: 500,
  /** 复合剧本总时长（ms） */
  totalDuration: 90_000,
  /** 决策完成后 toast 提示停留（ms） */
  toastDuration: 1800,
} as const;
