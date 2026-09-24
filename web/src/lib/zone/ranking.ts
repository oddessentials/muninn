import { explainResult, recommendationFor } from './explain';
import type { DiagnosticResult, RankedResult } from './types';

export function compareZoneLeaders(a: DiagnosticResult, b: DiagnosticResult): number {
  if (b.scores.overall !== a.scores.overall) return b.scores.overall - a.scores.overall;

  const aFail = a.measurements.network.failureRate ?? 1;
  const bFail = b.measurements.network.failureRate ?? 1;
  if (aFail !== bFail) return aFail - bFail;

  const aLatency = a.measurements.network.latencyMedianMs ?? Number.POSITIVE_INFINITY;
  const bLatency = b.measurements.network.latencyMedianMs ?? Number.POSITIVE_INFINITY;
  if (aLatency !== bLatency) return aLatency - bLatency;

  const aJitter = a.measurements.network.jitterMs ?? Number.POSITIVE_INFINITY;
  const bJitter = b.measurements.network.jitterMs ?? Number.POSITIVE_INFINITY;
  if (aJitter !== bJitter) return aJitter - bJitter;

  const aCpu = a.measurements.cpu.singleThread ?? 0;
  const bCpu = b.measurements.cpu.singleThread ?? 0;
  if (aCpu !== bCpu) return bCpu - aCpu;

  if (b.scores.stability !== a.scores.stability) return b.scores.stability - a.scores.stability;

  return a.player.name.localeCompare(b.player.name);
}

export function rankResults(results: DiagnosticResult[]): RankedResult[] {
  return [...results].sort(compareZoneLeaders).map((result, index) => {
    const recommendation = recommendationFor(result);
    return {
      rank: index + 1,
      result,
      recommendation,
      explanation: explainResult(result, recommendation)
    };
  });
}
