import { REVISION, WebGPURenderer } from 'three/webgpu';

export interface AdapterDiagnostics {
  readonly vendor: string;
  readonly architecture: string;
  readonly device: string;
  readonly description: string;
  readonly driver: string | null;
  readonly isFallbackAdapter: boolean;
  readonly subgroupMinSize: number;
  readonly subgroupMaxSize: number;
}

export interface WebGpuDiagnostics {
  readonly browser: string;
  readonly threeRevision: string;
  readonly backend: 'webgpu';
  readonly adapter: AdapterDiagnostics;
  readonly features: readonly string[];
  readonly limits: {
    readonly maxTextureDimension3D: number;
    readonly maxStorageBuffersPerShaderStage: number;
    readonly maxStorageTexturesPerShaderStage: number;
    readonly maxComputeInvocationsPerWorkgroup: number;
    readonly maxComputeWorkgroupSizeX: number;
    readonly maxComputeWorkgroupSizeY: number;
    readonly maxComputeWorkgroupSizeZ: number;
  };
}

export interface WebGpuSession {
  readonly renderer: WebGPURenderer;
  readonly device: GPUDevice;
  readonly diagnostics: WebGpuDiagnostics;
  readonly errors: string[];
  dispose(): void;
}

interface BackendIdentity {
  readonly isWebGPUBackend?: boolean;
}

interface ExtendedAdapterInfo extends GPUAdapterInfo {
  readonly driver?: string;
}

export class WebGpuCapabilityError extends Error {
  constructor(
    readonly stage: 'navigator' | 'adapter' | 'device' | 'renderer' | 'backend',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'WebGpuCapabilityError';
  }
}

export function verifyWebGpuBackend(renderer: {
  readonly backend: unknown;
}): asserts renderer is { readonly backend: BackendIdentity } {
  const backend = renderer.backend as BackendIdentity | null;

  if (backend?.isWebGPUBackend !== true) {
    throw new WebGpuCapabilityError(
      'backend',
      'Three.js initialized a non-WebGPU fallback backend.',
    );
  }
}

function describeAdapter(info: GPUAdapterInfo): AdapterDiagnostics {
  const extendedInfo = info as ExtendedAdapterInfo;

  return {
    vendor: info.vendor,
    architecture: info.architecture,
    device: info.device,
    description: info.description,
    driver: extendedInfo.driver || info.description || null,
    isFallbackAdapter: info.isFallbackAdapter,
    subgroupMinSize: info.subgroupMinSize,
    subgroupMaxSize: info.subgroupMaxSize,
  };
}

function stringifyError(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

export async function createWebGpuSession(
  canvas: HTMLCanvasElement,
): Promise<WebGpuSession> {
  if (!('gpu' in navigator)) {
    throw new WebGpuCapabilityError(
      'navigator',
      'This browser does not expose navigator.gpu.',
    );
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
    forceFallbackAdapter: false,
  });

  if (!adapter) {
    throw new WebGpuCapabilityError(
      'adapter',
      'The browser could not create a hardware WebGPU adapter.',
    );
  }

  if (adapter.info.isFallbackAdapter) {
    throw new WebGpuCapabilityError(
      'adapter',
      'The browser selected a fallback WebGPU adapter instead of hardware.',
    );
  }

  let device: GPUDevice;
  try {
    device = await adapter.requestDevice({
      label: 'Bismuth WebGPU device',
      requiredFeatures: Array.from(adapter.features) as GPUFeatureName[],
    });
  } catch (error) {
    throw new WebGpuCapabilityError(
      'device',
      `Unable to create a WebGPU device: ${stringifyError(error)}`,
      { cause: error },
    );
  }

  const errors: string[] = [];
  device.addEventListener('uncapturederror', (event) => {
    errors.push(`${event.error.constructor.name}: ${event.error.message}`);
  });

  const renderer = new WebGPURenderer({
    canvas,
    antialias: false,
    alpha: false,
    device,
    powerPreference: 'high-performance',
  });
  renderer.onError = (error: unknown) => {
    errors.push(stringifyError(error));
  };

  try {
    await renderer.init();
  } catch (error) {
    device.destroy();
    throw new WebGpuCapabilityError(
      'renderer',
      `Three.js WebGPURenderer initialization failed: ${stringifyError(error)}`,
      { cause: error },
    );
  }

  try {
    verifyWebGpuBackend(renderer);
  } catch (error) {
    renderer.dispose();
    throw error;
  }

  const limits = adapter.limits;
  const diagnostics: WebGpuDiagnostics = {
    browser: navigator.userAgent,
    threeRevision: REVISION,
    backend: 'webgpu',
    adapter: describeAdapter(adapter.info),
    features: Array.from(device.features).sort(),
    limits: {
      maxTextureDimension3D: limits.maxTextureDimension3D,
      maxStorageBuffersPerShaderStage: limits.maxStorageBuffersPerShaderStage,
      maxStorageTexturesPerShaderStage: limits.maxStorageTexturesPerShaderStage,
      maxComputeInvocationsPerWorkgroup:
        limits.maxComputeInvocationsPerWorkgroup,
      maxComputeWorkgroupSizeX: limits.maxComputeWorkgroupSizeX,
      maxComputeWorkgroupSizeY: limits.maxComputeWorkgroupSizeY,
      maxComputeWorkgroupSizeZ: limits.maxComputeWorkgroupSizeZ,
    },
  };

  return {
    renderer,
    device,
    diagnostics,
    errors,
    dispose() {
      renderer.dispose();
    },
  };
}
