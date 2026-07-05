import type { ReactNode } from 'react';
import { ControlRail } from './ControlRail';
import { TimelineStrip } from './TimelineStrip';
import { TopBar } from './TopBar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="app-shell">
      <TopBar />
      <section className="workspace" aria-label="Generator workspace">
        {children}
        <ControlRail />
      </section>
      <TimelineStrip />
    </main>
  );
}
