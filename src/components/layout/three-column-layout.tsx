interface ThreeColumnLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  /** 左栏宽度（px），默认 240 */
  leftWidth?: number;
  /** 右栏宽度（px），默认 360 */
  rightWidth?: number;
}

export function ThreeColumnLayout({
  left,
  center,
  right,
  leftWidth = 240,
  rightWidth = 360,
}: ThreeColumnLayoutProps) {
  const gridTemplate = `${leftWidth}px minmax(0,1fr) ${rightWidth}px`;
  return (
    <div
      className="grid h-full"
      style={{ gridTemplateColumns: gridTemplate }}
    >
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
