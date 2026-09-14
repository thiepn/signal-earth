export type DeviceTier = 'constrained' | 'balanced' | 'capable';

export interface DeviceCapabilities {
  tier: DeviceTier;
  coarsePointer: boolean;
  hoverCapable: boolean;
  maxTouchPoints: number;
  hardwareConcurrency: number;
  deviceMemoryGb: number | null;
  devicePixelRatio: number;
  viewportPixels: number;
  webgl2: boolean;
}

function match(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

function supportsWebGl2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }));
  } catch {
    return false;
  }
}

export function classifyDevice(capabilities: Omit<DeviceCapabilities, 'tier'>): DeviceTier {
  const memory = capabilities.deviceMemoryGb ?? 4;
  if (
    memory <= 2 ||
    capabilities.hardwareConcurrency <= 2 ||
    capabilities.viewportPixels > 8_500_000 ||
    !capabilities.webgl2
  ) return 'constrained';

  if (
    !capabilities.coarsePointer &&
    memory >= 8 &&
    capabilities.hardwareConcurrency >= 8 &&
    capabilities.viewportPixels < 5_500_000
  ) return 'capable';

  return 'balanced';
}

export function detectDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      tier: 'balanced', coarsePointer: false, hoverCapable: true, maxTouchPoints: 0,
      hardwareConcurrency: 4, deviceMemoryGb: null, devicePixelRatio: 1,
      viewportPixels: 1_000_000, webgl2: true,
    };
  }

  const nav = navigator as Navigator & { deviceMemory?: number };
  const base = {
    coarsePointer: match('(pointer: coarse)'),
    hoverCapable: match('(hover: hover)'),
    maxTouchPoints: navigator.maxTouchPoints || 0,
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    devicePixelRatio: Math.max(1, window.devicePixelRatio || 1),
    viewportPixels: Math.max(1, window.innerWidth * window.innerHeight * Math.max(1, window.devicePixelRatio || 1)),
    webgl2: supportsWebGl2(),
  };
  return { ...base, tier: classifyDevice(base) };
}
