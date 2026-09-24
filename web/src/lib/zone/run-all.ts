import { buildDiagnosticResult } from './result';
import { runCpuBenchmark } from './run-cpu';
import { runNetworkBenchmark } from './run-network';
import { runStabilityBenchmark } from './run-stability';
import { collectSystemInfo } from './system';
import type { DiagnosticResult, DiagnosticTarget, Measurements, TestStatus } from './types';

export type DiagnosticPhase = 'cpu' | 'stability' | 'network' | 'score';

export interface DiagnosticProgress {
  phase: DiagnosticPhase;
  label: string;
  fraction: number;
}

export interface DiagnosticRun {
  playerName: string;
  target: DiagnosticTarget;
  onProgress?: (progress: DiagnosticProgress) => void;
  shouldAbort?: () => boolean;
}

const emptyNetwork: Measurements['network'] = {
  latencyMedianMs: null,
  latencyP95Ms: null,
  jitterMs: null,
  uploadMbps: null,
  downloadMbps: null,
  failureRate: null,
  latencySamplesMs: [],
  failedRequests: 0,
  totalRequests: 0,
  endpointReachable: false
};

const emptyStability: Measurements['stability'] = {
  frameTimeP95Ms: null,
  frameTimeMedianMs: null,
  stallCount: null,
  gpuFrameMs: null,
  gpuApi: 'none'
};

export async function runFullDiagnostic(input: DiagnosticRun): Promise<DiagnosticResult> {
  const warnings: string[] = [];
  let tabLostFocus = false;
  const onVisibility = () => {
    if (document.hidden) tabLostFocus = true;
  };
  document.addEventListener('visibilitychange', onVisibility);
  const report = (phase: DiagnosticPhase, label: string, fraction: number) =>
    input.onProgress?.({ phase, label, fraction });
  const finish = (
    measurements: Measurements,
    status: Record<keyof Measurements, TestStatus>,
    interrupted: boolean
  ) =>
    buildDiagnosticResult({
      playerName: input.playerName,
      diagnosticTarget: input.target,
      system: collectSystemInfo(),
      measurements,
      completion: { ...status, tabLostFocus, interrupted, warnings }
    });

  try {
    report('cpu', 'Measuring the CPU', 0.04);
    const cpu = await runCpuBenchmark((label) => report('cpu', label, 0.08));
    if (cpu.warning) warnings.push(cpu.warning);
    if (input.shouldAbort?.()) {
      warnings.push('The diagnostic was interrupted.');
      return finish(
        { cpu: cpu.measurements, network: emptyNetwork, stability: emptyStability },
        { cpu: cpu.status, network: 'skipped', stability: 'skipped' },
        true
      );
    }

    report('stability', 'Watching frame times', 0.42);
    const stability = await runStabilityBenchmark();
    if (stability.warning) warnings.push(stability.warning);

    report('network', 'Measuring the network', 0.62);
    const network = await runNetworkBenchmark(input.target.endpoint, (label) =>
      report('network', label, 0.7)
    );
    if (network.warning) warnings.push(network.warning);

    if (tabLostFocus) {
      warnings.push('This tab lost focus during the test. Results may be less consistent.');
    }
    if (cpu.measurements.variance !== null && cpu.measurements.variance > 0.18) {
      warnings.push(
        'CPU samples were unusually inconsistent. Power saving or thermal throttling may have interfered.'
      );
    }

    report('score', 'Scoring', 0.96);
    return finish(
      { cpu: cpu.measurements, network: network.measurements, stability: stability.measurements },
      { cpu: cpu.status, network: network.status, stability: stability.status },
      false
    );
  } finally {
    document.removeEventListener('visibilitychange', onVisibility);
  }
}
