import { classifyRecommendation } from './scoring';
import type { DiagnosticResult, PlayerExplanation, Recommendation } from './types';

function fmtMs(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return 'unavailable';
  return `${value.toFixed(digits)} ms`;
}

function fmtMbps(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'unavailable';
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} Mbps`;
}

export function recommendationFor(result: DiagnosticResult): Recommendation {
  return classifyRecommendation(
    result.scores,
    result.measurements,
    result.completion,
    result.penalties
  );
}

export function explainResult(
  result: DiagnosticResult,
  recommendation: Recommendation = recommendationFor(result)
): PlayerExplanation {
  const n = result.measurements.network;
  const cpu = result.measurements.cpu;
  const scores = result.scores;
  const strongest: string[] = [];
  const limiting: string[] = [];

  if (n.failureRate === 0 && n.jitterMs !== null && n.jitterMs <= 4) {
    strongest.push('No request failures and tight jitter.');
  } else if (n.failureRate === 0) {
    strongest.push('No request failures during the network test.');
  }
  if (n.latencyMedianMs !== null && n.latencyMedianMs <= 25 && scores.network >= 80) {
    strongest.push(`Low median latency (${fmtMs(n.latencyMedianMs, 1)}).`);
  }
  if (n.jitterMs !== null && n.jitterMs <= 3) {
    strongest.push(`Very low jitter (${fmtMs(n.jitterMs, 1)}).`);
  }
  if (scores.cpu >= 85 && (cpu.singleThread ?? 0) >= 300000) {
    strongest.push('Strong measured single-thread CPU performance for zone simulation.');
  } else if (scores.cpu >= 75) {
    strongest.push('Solid measured CPU throughput.');
  }
  if (scores.stability >= 85) {
    strongest.push('Consistent frame times and stable benchmark samples.');
  }
  if (
    n.uploadMbps !== null &&
    n.uploadMbps >= 18 &&
    n.latencyMedianMs !== null &&
    n.latencyMedianMs <= 30
  ) {
    strongest.push(`Upload is more than adequate (${fmtMbps(n.uploadMbps)}).`);
  }

  if ((n.failureRate ?? 0) >= 0.03) {
    limiting.push(
      `Request failure rate of ${((n.failureRate ?? 0) * 100).toFixed(0)}% threatens zone ownership.`
    );
  }
  if (n.jitterMs !== null && n.jitterMs >= 12) {
    limiting.push(`High jitter (${fmtMs(n.jitterMs, 1)}) will desynchronize nearby players.`);
  }
  if (
    n.latencyP95Ms !== null &&
    n.latencyMedianMs !== null &&
    n.latencyP95Ms - n.latencyMedianMs >= 20
  ) {
    limiting.push(
      `Latency spikes to ${fmtMs(n.latencyP95Ms, 1)} p95 on a ${fmtMs(n.latencyMedianMs, 1)} median.`
    );
  }
  if (n.latencyMedianMs !== null && n.latencyMedianMs >= 50) {
    limiting.push(`High round-trip latency (${fmtMs(n.latencyMedianMs, 1)}).`);
  }
  if (n.uploadMbps !== null && n.uploadMbps < 8) {
    limiting.push(`Upload throughput is tight for hosting a busy zone (${fmtMbps(n.uploadMbps)}).`);
  }
  if (scores.cpu < 60 || (cpu.singleThread !== null && cpu.singleThread < 150000)) {
    limiting.push('Measured single-thread CPU performance is a limiting factor.');
  }
  if (cpu.variance !== null && cpu.variance > 0.12) {
    limiting.push('CPU samples varied more than expected, so the results may be noisy.');
  }
  if (scores.stability < 60) {
    limiting.push('Frame-time or benchmark instability showed up during the test.');
  }
  if (result.completion.tabLostFocus) {
    limiting.push('The browser tab lost focus during the run, which can distort measurements.');
  }
  if (result.completion.cpu === 'failed') limiting.push('The CPU diagnostic did not finish.');
  if (result.completion.network === 'failed') {
    limiting.push('The network diagnostic did not finish.');
  }

  const uniqueStrong = [...new Set(strongest)].slice(0, 3);
  const uniqueLimit = [...new Set(limiting)].slice(0, 4);
  const firstLimit = uniqueLimit[0];

  let reason: string;
  if (recommendation === 'primary') {
    reason =
      firstLimit === undefined
        ? 'Network quality and single-thread CPU performance are both strong enough to own a zone.'
        : `Best overall choice among current results, with only minor limits: ${firstLimit}`;
  } else if (recommendation === 'backup') {
    reason =
      firstLimit ?? 'Suitable as a backup zone leader if a stronger connection is unavailable.';
  } else {
    const penaltyMessage = result.penalties[0]?.message;
    if (penaltyMessage) {
      reason = penaltyMessage;
    } else if (scores.cpu >= 75 && scores.network < 70) {
      reason = 'CPU performance is strong, but the connection is poorly suited to area ownership.';
    } else if (scores.network >= 75 && scores.cpu < 60) {
      reason =
        'The connection is serviceable, but measured single-thread CPU performance is too weak to simulate a busy zone.';
    } else {
      reason =
        firstLimit ??
        'Connection or performance characteristics make this a poor zone-leader candidate.';
    }
  }

  const summary =
    recommendation === 'avoid'
      ? reason
      : recommendation === 'primary'
        ? `${result.player.name} is a primary zone-leader candidate (${scores.overall}/100).`
        : `${result.player.name} is a reasonable backup (${scores.overall}/100).`;

  return { summary, strongest: uniqueStrong, limiting: uniqueLimit, reason };
}
