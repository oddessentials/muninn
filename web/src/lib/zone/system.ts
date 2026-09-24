import type { SystemInfo, ValueSource } from './types';

interface ExtendedNavigator extends Navigator {
  deviceMemory?: number;
  userAgentData?: { brands?: { brand: string; version: string }[]; platform?: string };
}

function parseBrowser(userAgent: string): string | null {
  if (/Edg\//.test(userAgent)) return 'Edge';
  if (/OPR\//.test(userAgent) || /Opera/.test(userAgent)) return 'Opera';
  if (/Chrome\//.test(userAgent) && !/Chromium\//.test(userAgent)) return 'Chrome';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return 'Safari';
  return null;
}

function readGpu(): { renderer: string | null; vendor: string | null; source: ValueSource } {
  const unavailable = { renderer: null, vendor: null, source: 'unavailable' as const };
  if (typeof document === 'undefined') return unavailable;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return unavailable;
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer: unknown = extension
      ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    const vendor: unknown = extension
      ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR);
    if (typeof renderer !== 'string' || !renderer) return unavailable;
    return {
      renderer,
      vendor: typeof vendor === 'string' ? vendor : null,
      source: 'reported'
    };
  } catch {
    return unavailable;
  }
}

export function collectSystemInfo(): SystemInfo {
  const nav = typeof navigator === 'undefined' ? null : (navigator as ExtendedNavigator);
  const userAgent = nav?.userAgent ?? '';
  const logical = nav?.hardwareConcurrency;
  const memory = nav?.deviceMemory;
  const uaData = nav?.userAgentData;
  const gpu = readGpu();
  const browser = parseBrowser(userAgent);
  const platform =
    (typeof uaData?.platform === 'string' && uaData.platform) ||
    (typeof nav?.platform === 'string' && nav.platform) ||
    null;
  const processors = typeof logical === 'number' && logical > 0 ? logical : null;
  return {
    logicalProcessors: processors,
    logicalProcessorsSource: processors === null ? 'unavailable' : 'reported',
    deviceMemoryGB: typeof memory === 'number' && memory > 0 ? memory : null,
    deviceMemorySource: typeof memory === 'number' && memory > 0 ? 'reported' : 'unavailable',
    gpuRenderer: gpu.renderer,
    gpuVendor: gpu.vendor,
    gpuSource: gpu.source,
    browser,
    browserSource: browser ? 'reported' : 'unavailable',
    platform,
    platformSource: platform ? 'reported' : 'unavailable',
    hardwareConcurrency: processors,
    userAgentDataBrands: uaData?.brands?.map((entry) => entry.brand) ?? null
  };
}

export function sourceLabel(source: ValueSource): string {
  if (source === 'measured') return 'measured';
  if (source === 'reported') return 'browser-reported';
  return 'unavailable';
}
