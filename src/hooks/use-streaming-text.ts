import { useEffect, useRef, useState } from 'react';

/**
 * 流式打字效果 hook —— Agent 消息逐字符显示。
 * agent_console_spec.md §4.3：默认 30 字符/秒，演示模式 90 字符/秒。
 *
 * 返回 `complete()` 让用户能手动跳过（点"下一步"时强制打完）。
 */
export function useStreamingText(
  text: string,
  options: { speed?: number; enabled?: boolean } = {},
): { displayed: string; isComplete: boolean; complete: () => void } {
  const { speed = 30, enabled = true } = options;
  const [displayed, setDisplayed] = useState(enabled ? '' : text);
  const indexRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    indexRef.current = 0;
    if (!enabled) {
      setDisplayed(text);
      return;
    }
    setDisplayed('');
    const stepMs = Math.max(8, Math.round(1000 / speed));
    intervalRef.current = window.setInterval(() => {
      indexRef.current += 1;
      if (indexRef.current >= text.length) {
        setDisplayed(text);
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        setDisplayed(text.slice(0, indexRef.current));
      }
    }, stepMs);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text, speed, enabled]);

  const complete = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDisplayed(text);
  };

  return {
    displayed,
    isComplete: displayed.length >= text.length,
    complete,
  };
}
