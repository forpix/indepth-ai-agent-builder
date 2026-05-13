interface ThreeColumnLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}

export function ThreeColumnLayout({
  left,
  center,
  right,
}: ThreeColumnLayoutProps) {
  return (
    <div className="grid h-full grid-cols-[240px_minmax(0,1fr)_360px]">
      <aside className="min-h-0 overflow-hidden border-r border-border bg-surface">
        {left}
      </aside>
      <section className="min-h-0 overflow-hidden bg-bg">{center}</section>
      <aside className="min-h-0 overflow-hidden border-l border-border bg-surface">
        {right}
      </aside>
    </div>
  );
}
