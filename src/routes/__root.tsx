import { Link, Outlet, createRootRoute } from '@tanstack/react-router';
import { Save, Send, FileCode2, Bookmark } from 'lucide-react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export const Route = createRootRoute({
  component: RootLayout,
});

const TABS = [
  { to: '/skill-builder', label: 'Skill Builder', subtitle: '配置 Skill' },
  { to: '/agent-console', label: 'Agent Console', subtitle: '运行 Agent' },
  { to: '/debug-eval', label: 'Debug & Eval', subtitle: '调试与评测' },
] as const;

function RootLayout() {
  return (
    <TooltipProvider delayDuration={200}>
      <RootShell />
    </TooltipProvider>
  );
}

function RootShell() {
  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      {/* 顶部品牌区 + Tab + 全局动作 */}
      <header className="flex h-14 shrink-0 items-center gap-6 border-b border-border bg-surface px-6">
        <a
          href="/"
          title="forpix — AI Product Demos"
          className="flex items-center gap-1 text-[12px] text-muted hover:text-text"
        >
          <span aria-hidden className="text-[14px] leading-none">←</span>
          forpix
        </a>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[13px] font-semibold text-primary-foreground">
            鼎
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold tracking-wide">
              鼎捷 Indepth AI
            </span>
            <span className="text-[11px] text-muted">
              采购协同 Agent 编排工作台
            </span>
          </div>
        </div>

        <nav className="flex h-full items-stretch">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className="group relative flex items-center px-4 text-[13px] text-muted hover:text-text"
              activeProps={{ className: 'text-text' }}
            >
              {({ isActive }) => (
                <>
                  <span className="font-medium">{tab.label}</span>
                  {isActive && (
                    <span className="absolute inset-x-3 bottom-0 h-[2px] bg-accent" />
                  )}
                </>
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <TopBarButton icon={<Save className="h-3.5 w-3.5" />} label="保存" />
          <TopBarButton
            icon={<Bookmark className="h-3.5 w-3.5" />}
            label="另存为模板"
          />
          <TopBarButton
            icon={<FileCode2 className="h-3.5 w-3.5" />}
            label="切换 Code View"
          />
          <TopBarButton
            icon={<Send className="h-3.5 w-3.5" />}
            label="发布"
            variant="primary"
          />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

interface TopBarButtonProps {
  icon: React.ReactNode;
  label: string;
  variant?: 'default' | 'primary';
}

function TopBarButton({ icon, label, variant = 'default' }: TopBarButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] transition-colors',
        variant === 'primary'
          ? 'border-accent bg-accent text-accent-foreground hover:brightness-110'
          : 'border-border bg-surface text-text hover:bg-bg',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
