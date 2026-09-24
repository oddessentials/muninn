import { computeScores, ratingFromOverall } from './scoring';
import type { DiagnosticResult } from './types';
import { isCompatibleDiagnosticVersion } from './version';

const scoreTolerance = 1;

export type CheckFailure = 'incompatible-version' | 'impossible' | 'incomplete';

export type CheckedResult =
  | { ok: true; result: DiagnosticResult; tampered: boolean }
  | { ok: false; code: CheckFailure; message: string };

function impossibility(result: DiagnosticResult): string | null {
  const { measurements: m, scores, system } = result;
  if (Object.values(scores).some((n) => n < 0 || n > 100 || !Number.isFinite(n))) {
    return 'Scores must be finite numbers between 0 and 100.';
  }
  const n = m.network;
  if (n.failureRate !== null && (n.failureRate < 0 || n.failureRate > 1)) {
    return 'Failure rate must be between 0 and 1.';
  }
  if (n.latencyMedianMs !== null && n.latencyMedianMs < 0) return 'Latency cannot be negative.';
  if (n.jitterMs !== null && n.jitterMs < 0) return 'Jitter cannot be negative.';
  if (
    n.latencyMedianMs !== null &&
    n.latencyP95Ms !== null &&
    n.latencyP95Ms + 0.05 < n.latencyMedianMs
  ) {
    return 'p95 latency cannot be lower than the median.';
  }
  if (n.uploadMbps !== null && n.uploadMbps < 0) return 'Upload cannot be negative.';
  if (n.downloadMbps !== null && n.downloadMbps < 0) return 'Download cannot be negative.';
  if (n.failedRequests > n.totalRequests) return 'Failed requests exceed total requests.';
  if (m.cpu.singleThread !== null && m.cpu.singleThread < 0) {
    return 'CPU throughput cannot be negative.';
  }
  if (m.cpu.multiThread !== null && m.cpu.multiThread < 0) {
    return 'CPU throughput cannot be negative.';
  }
  if (
    system.logicalProcessors !== null &&
    (system.logicalProcessors < 1 || system.logicalProcessors > 256)
  ) {
    return 'Logical processor count is outside a plausible range.';
  }
  if (
    system.deviceMemoryGB !== null &&
    (system.deviceMemoryGB < 0 || system.deviceMemoryGB > 1024)
  ) {
    return 'Device memory is outside a plausible range.';
  }
  if (!Number.isFinite(Date.parse(result.testedAt))) return 'testedAt is not a valid timestamp.';
  return null;
}

function incompleteness(result: DiagnosticResult): string | null {
  const { completion, measurements } = result;
  if (completion.interrupted) return 'The diagnostic was interrupted before completion.';
  if (completion.cpu !== 'ok' && completion.cpu !== 'partial') {
    return 'The CPU diagnostic did not complete.';
  }
  if (completion.network !== 'ok' && completion.network !== 'partial') {
    return 'The network diagnostic did not complete.';
  }
  if (measurements.cpu.singleThread === null) {
    return 'The measured single-thread CPU result is missing.';
  }
  if (measurements.network.latencyMedianMs === null && completion.network !== 'partial') {
    return 'The network latency measurements are missing.';
  }
  return null;
}

export function checkResult(result: DiagnosticResult): CheckedResult {
  if (!isCompatibleDiagnosticVersion(result.diagnosticVersion)) {
    return {
      ok: false,
      code: 'incompatible-version',
      message: `Incompatible diagnostic version (${result.diagnosticVersion}).`
    };
  }
  const impossible = impossibility(result);
  if (impossible) return { ok: false, code: 'impossible', message: impossible };

  const recomputed = computeScores(result.measurements, result.system, result.completion);
  const tampered = (['overall', 'network', 'cpu', 'stability'] as const).some(
    (key) => Math.abs(recomputed.scores[key] - result.scores[key]) > scoreTolerance
  );
  const checked: DiagnosticResult = {
    ...result,
    scores: recomputed.scores,
    rating: ratingFromOverall(recomputed.scores.overall),
    penalties: recomputed.penalties
  };

  const incomplete = incompleteness(checked);
  if (incomplete) return { ok: false, code: 'incomplete', message: incomplete };
  return { ok: true, result: checked, tampered };
}
