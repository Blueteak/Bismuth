import { GeneratorViewport } from './rendering/GeneratorViewport';
import { AppShell } from './ui/AppShell';

export function App() {
  return (
    <AppShell>
      <GeneratorViewport />
    </AppShell>
  );
}
