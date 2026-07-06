import { useEffect, useRef } from 'react';
import { GeneratorViewport } from './rendering/GeneratorViewport';
import { useAppStore } from './state/appStore';
import { AppShell } from './ui/AppShell';

export function App() {
  const hasStarted = useRef(false);
  const regeneratePreview = useAppStore((state) => state.regeneratePreview);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;
    regeneratePreview();
  }, [regeneratePreview]);

  return (
    <AppShell>
      <GeneratorViewport />
    </AppShell>
  );
}
