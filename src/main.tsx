import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getInjectedCapabilityState } from './app/capability-state';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing React root element.');
}

const applicationRoot: HTMLElement = rootElement;

async function startApplication(): Promise<void> {
  if (import.meta.env.DEV && window.location.pathname === '/__dev/material') {
    const mode = new URLSearchParams(window.location.search).get('mode');
    if (mode === 'material') {
      const { mountMaterialFixture } = await import('./dev/material-fixture');
      mountMaterialFixture(applicationRoot);
    } else {
      const { mountCandidate2eGeometryFixture } =
        await import('./dev/candidate2e-geometry-fixture');
      mountCandidate2eGeometryFixture(applicationRoot);
    }
    return;
  }

  createRoot(applicationRoot).render(
    <StrictMode>
      <App capabilityState={getInjectedCapabilityState()} />
    </StrictMode>,
  );
}

void startApplication();
