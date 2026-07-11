import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getInjectedCapabilityState } from './app/capability-state';
import { getRuntimeSummary } from './diagnostics';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing React root element.');
}

const applicationRoot: HTMLElement = rootElement;

async function startApplication(): Promise<void> {
  if (
    import.meta.env.DEV &&
    window.location.pathname === '/__dev/webgpu-proof'
  ) {
    const { mountGpuProofFixture } = await import('./dev/gpu-proof-fixture');
    mountGpuProofFixture(applicationRoot);
    return;
  }

  if (
    import.meta.env.DEV &&
    window.location.pathname === '/__dev/single-crystal'
  ) {
    const { mountSingleCrystalFixture } =
      await import('./dev/single-crystal-fixture');
    mountSingleCrystalFixture(applicationRoot);
    return;
  }

  if (import.meta.env.DEV) {
    console.info('[Bismuth] Milestone 0C foundation', getRuntimeSummary());
  }

  createRoot(applicationRoot).render(
    <StrictMode>
      <App capabilityState={getInjectedCapabilityState()} />
    </StrictMode>,
  );
}

void startApplication();
