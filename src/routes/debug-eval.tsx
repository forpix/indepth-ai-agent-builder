import { createFileRoute } from '@tanstack/react-router';

import { DebugEvalHeader } from '@/components/debug-eval/debug-eval-header';
import { EvalDashboard } from '@/components/debug-eval/eval-dashboard';
import { TraceDetail } from '@/components/debug-eval/trace-detail';
import { TraceList } from '@/components/debug-eval/trace-list';
import { ThreeColumnLayout } from '@/components/layout/three-column-layout';

export const Route = createFileRoute('/debug-eval')({
  component: DebugEvalPage,
});

function DebugEvalPage() {
  return (
    <div className="flex h-full flex-col">
      <DebugEvalHeader />
      <div className="min-h-0 flex-1 overflow-hidden">
        <ThreeColumnLayout
          left={<TraceList />}
          center={<TraceDetail />}
          right={<EvalDashboard />}
          leftWidth={320}
        />
      </div>
    </div>
  );
}
