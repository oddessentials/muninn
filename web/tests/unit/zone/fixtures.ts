import { buildDiagnosticResult } from '$lib/zone/result';
import type { CompletionInfo, DiagnosticResult, Measurements, SystemInfo } from '$lib/zone/types';

export const defaultSystem: SystemInfo = {
  logicalProcessors: 8,
  logicalProcessorsSource: 'reported',
  deviceMemoryGB: 16,
  deviceMemorySource: 'reported',
  gpuRenderer: 'ANGLE (AMD Radeon RX 7800 XT)',
  gpuVendor: 'AMD',
  gpuSource: 'reported',
  browser: 'Chrome',
  browserSource: 'reported',
  platform: 'Windows',
  platformSource: 'reported',
  hardwareConcurrency: 8,
  userAgentDataBrands: ['Chromium']
};

export const defaultCompletion: CompletionInfo = {
  cpu: 'ok',
  network: 'ok',
  stability: 'ok',
  tabLostFocus: false,
  interrupted: false,
  warnings: []
};

export function makeMeasurements(
  overrides: {
    cpu?: Partial<Measurements['cpu']>;
    network?: Partial<Measurements['network']>;
    stability?: Partial<Measurements['stability']>;
  } = {}
): Measurements {
  return {
    cpu: {
      singleThread: 390000,
      multiThread: 1950000,
      variance: 0.02,
      samples: [385700, 392200, 391100, 388900, 394300],
      workersUsed: 8,
      kernel: 'vzd-cpu-1.0.0',
      ...overrides.cpu
    },
    network: {
      latencyMedianMs: 18,
      latencyP95Ms: 27,
      jitterMs: 2.1,
      uploadMbps: 25,
      downloadMbps: 80,
      failureRate: 0,
      latencySamplesMs: [17, 18, 19, 18, 21, 18, 17, 20, 18, 19],
      failedRequests: 0,
      totalRequests: 14,
      endpointReachable: true,
      ...overrides.network
    },
    stability: {
      frameTimeP95Ms: 8.4,
      frameTimeMedianMs: 6.9,
      stallCount: 0,
      gpuFrameMs: 6.2,
      gpuApi: 'webgl2',
      ...overrides.stability
    }
  };
}

export function makeResult(input: {
  name: string;
  testedAt?: string;
  measurements?: Measurements;
  system?: Partial<SystemInfo>;
  completion?: Partial<CompletionInfo>;
}): DiagnosticResult {
  return buildDiagnosticResult({
    playerName: input.name,
    testedAt: input.testedAt ?? '2026-09-10T15:32:41.000Z',
    diagnosticTarget: {
      label: 'Guild site',
      endpoint: 'https://guild.example.org/api/v1/zone/probe'
    },
    system: { ...defaultSystem, ...input.system },
    measurements: input.measurements ?? makeMeasurements(),
    completion: { ...defaultCompletion, ...input.completion }
  });
}
