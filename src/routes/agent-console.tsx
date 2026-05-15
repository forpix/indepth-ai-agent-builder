import { createFileRoute } from '@tanstack/react-router';

import { ThreeColumnLayout } from '@/components/layout/three-column-layout';
import { BottomStatusBar } from '@/components/agent-console/bottom-status-bar';
import { ConversationPanel } from '@/components/agent-console/conversation-panel';
import { D7MiniSkillBuilder } from '@/components/agent-console/d7-mini-skill-builder';
import { DecisionPanel } from '@/components/agent-console/decision-panel';
import { DecisionToast } from '@/components/agent-console/decision-toast';
import { LlmErrorToast } from '@/components/agent-console/llm-error-toast';
import { MockCursor } from '@/components/agent-console/mock-cursor';
import { OrderTable } from '@/components/agent-console/order-table';
import { ReviewModal } from '@/components/agent-console/review-modal';
import { ScenarioHeader } from '@/components/agent-console/scenario-header';

export const Route = createFileRoute('/agent-console')({
  component: AgentConsolePage,
});

function AgentConsolePage() {
  return (
    <div className="flex h-full flex-col">
      <ScenarioHeader />
      <div className="min-h-0 flex-1 overflow-hidden">
        <ThreeColumnLayout
          left={<ConversationPanel />}
          center={<OrderTable />}
          right={<DecisionPanel />}
          leftWidth={320}
        />
      </div>
      <BottomStatusBar />

      {/* 全局覆盖层 */}
      <DecisionToast />
      <LlmErrorToast />
      <D7MiniSkillBuilder />
      <MockCursor />
      <ReviewModal />
    </div>
  );
}
