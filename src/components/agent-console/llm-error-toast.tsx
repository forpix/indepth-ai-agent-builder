import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { useScenarioStore } from '@/stores/scenario-store';

/**
 * 真 LLM 调用失败时的 toast 提示（4 秒自动清空）。
 * demo_scripts §2.3 ⑤：任何失败 → fallback mock，并向用户透明展示原因。
 */
export function LlmErrorToast() {
  const err = useScenarioStore((s) => s.llmLastError);
  const setLlmError = useScenarioStore((s) => s.setLlmError);

  useEffect(() => {
    if (!err) return;
    const t = window.setTimeout(() => setLlmError(null), 4000);
    return () => window.clearTimeout(t);
  }, [err, setLlmError]);

  if (!err) return null;

  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-[#92400E] shadow-lg">
        <AlertTriangle className="h-3.5 w-3.5" />
        {err}
      </div>
    </div>
  );
}
