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
    } else if (mode === 'candidate2c-evidence') {
      const { mountCandidate2CMorphologyFixture } =
        await import('./dev/candidate2c-morphology-fixture');
      mountCandidate2CMorphologyFixture(applicationRoot);
    } else if (mode === 'candidate2d-carrier-evidence') {
      const { mountCandidate2DTargetFixture } =
        await import('./dev/candidate2d-target-fixture');
      mountCandidate2DTargetFixture(applicationRoot);
    } else if (mode === 'candidate2d-twin-evidence') {
      const { mountCandidate2DTwinFixture } =
        await import('./dev/candidate2d-twin-fixture');
      mountCandidate2DTwinFixture(applicationRoot);
    } else {
      const { mountCandidate2DEdgeFixture } =
        await import('./dev/candidate2d-edge-fixture');
      mountCandidate2DEdgeFixture(applicationRoot);
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
