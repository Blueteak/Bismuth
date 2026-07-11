export type CapabilityState =
  | { readonly status: 'loading' }
  | { readonly status: 'unsupported'; readonly reason: string };

declare global {
  interface Window {
    __BISMUTH_CAPABILITY_STATE__?: CapabilityState;
  }
}

const loadingState: CapabilityState = { status: 'loading' };

export function resolveCapabilityState(value: unknown): CapabilityState {
  if (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    value.status === 'unsupported' &&
    'reason' in value &&
    typeof value.reason === 'string' &&
    value.reason.length > 0
  ) {
    return { status: 'unsupported', reason: value.reason };
  }

  return loadingState;
}

export function getInjectedCapabilityState(): CapabilityState {
  const injectedState = import.meta.env.DEV
    ? window.__BISMUTH_CAPABILITY_STATE__
    : undefined;

  return resolveCapabilityState(injectedState);
}
