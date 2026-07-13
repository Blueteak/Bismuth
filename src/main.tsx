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
    const { mountMaterialFixture } = await import('./dev/material-fixture');
    mountMaterialFixture(applicationRoot);
    return;
  }

  createRoot(applicationRoot).render(
    <StrictMode>
      <App capabilityState={getInjectedCapabilityState()} />
    </StrictMode>,
  );
}

void startApplication();
