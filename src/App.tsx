import { useEffect, useRef, useState } from 'react';
import type { CapabilityState } from './app/capability-state';
import { WebGpuCapabilityError } from './rendering/webgpu-capability';
import {
  createFoundationVisualizerController,
  isControllerDisposedError,
  type FoundationDiagnostics,
  type VisualizerController,
} from './visualizer/visualizer-controller';

export interface AppProps {
  capabilityState: CapabilityState;
}

type ShellState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'foundation';
      readonly diagnostics: FoundationDiagnostics;
    }
  | { readonly status: 'unsupported'; readonly reason: string }
  | { readonly status: 'error'; readonly reason: string };

declare global {
  interface Window {
    __BISMUTH_FOUNDATION__?: Promise<FoundationDiagnostics>;
  }
}

function initialShellState(capabilityState: CapabilityState): ShellState {
  return capabilityState.status === 'unsupported'
    ? capabilityState
    : { status: 'loading' };
}

function describeInitializationError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The rendering foundation could not be initialized.';
}

export function App({ capabilityState }: AppProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<VisualizerController | null>(null);
  const [shellState, setShellState] = useState<ShellState>(() =>
    initialShellState(capabilityState),
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || capabilityState.status === 'unsupported') {
      return;
    }

    let active = true;
    const controller = createFoundationVisualizerController(canvas);
    controllerRef.current = controller;

    if (import.meta.env.DEV) {
      window.__BISMUTH_FOUNDATION__ = controller.ready;
    }

    void controller.ready
      .then((diagnostics) => {
        if (active) {
          setShellState({ status: 'foundation', diagnostics });
        }
      })
      .catch((error: unknown) => {
        if (!active || isControllerDisposedError(error)) {
          return;
        }

        setShellState({
          status:
            error instanceof WebGpuCapabilityError ? 'unsupported' : 'error',
          reason: describeInitializationError(error),
        });
      });

    const resize = () => {
      controller.resize(
        canvas.clientWidth,
        canvas.clientHeight,
        window.devicePixelRatio,
      );
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    return () => {
      active = false;
      resizeObserver.disconnect();
      controller.dispose();
      controllerRef.current = null;
      if (window.__BISMUTH_FOUNDATION__ === controller.ready) {
        delete window.__BISMUTH_FOUNDATION__;
      }
    };
  }, [capabilityState]);

  const isFailure =
    shellState.status === 'unsupported' || shellState.status === 'error';
  const foundationDiagnostics =
    shellState.status === 'foundation' ? shellState.diagnostics : undefined;

  return (
    <main
      className="app-shell"
      data-foundation-state={shellState.status}
      data-renderer-backend={foundationDiagnostics?.webGpu.backend}
      data-environment-size={
        foundationDiagnostics
          ? `${foundationDiagnostics.environment.width}x${foundationDiagnostics.environment.height}`
          : undefined
      }
      data-environment-mapping={foundationDiagnostics?.environment.mapping}
      data-scene-object-count={foundationDiagnostics?.scene.objectCount}
    >
      <canvas
        ref={canvasRef}
        className="visualizer-canvas"
        aria-label="Bismuth crystal visualizer"
      />

      {shellState.status === 'loading' ? (
        <section className="status-panel" aria-live="polite">
          <p className="eyebrow">Bismuth Visualizer</p>
          <h1>Preparing the visualizer</h1>
          <p>Initializing WebGPU and the reflection environment.</p>
          <span className="loading-indicator" aria-hidden="true" />
        </section>
      ) : null}

      {shellState.status === 'foundation' ? (
        <section className="status-panel foundation-panel" aria-live="polite">
          <p className="eyebrow">Bismuth Visualizer</p>
          <h1>Rendering foundation ready</h1>
          <p>Crystal growth arrives with the validated scientific solver.</p>
        </section>
      ) : null}

      {isFailure ? (
        <section className="status-panel" role="alert">
          <p className="eyebrow">Bismuth Visualizer</p>
          <h1>
            {shellState.status === 'unsupported'
              ? 'WebGPU is required'
              : 'Initialization failed'}
          </h1>
          <p>{shellState.reason}</p>
        </section>
      ) : null}
    </main>
  );
}
