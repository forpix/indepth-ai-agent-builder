import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { TIMINGS } from '@/lib/scenario-timings';
import { useScenarioStore } from '@/stores/scenario-store';

/** PD-8 决策反馈 toast："决策已记入 Memory"——1.8s 自动关闭。 */
export function DecisionToast() {
  const toast = useScenarioStore((s) => s.toast);
  const dismissToast = useScenarioStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismissToast, TIMINGS.toastDuration);
    return () => window.clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed bottom-14 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-[12px] text-success shadow-lg">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {toast}
      </div>
    </div>
  );
}
