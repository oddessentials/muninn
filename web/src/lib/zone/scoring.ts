import {
  cpuTables,
  cpuWeights,
  hardPenaltyRules,
  hardPenaltyTriggers,
  networkTables,
  networkWeights,
  ratingThresholds,
  recommendationThresholds,
  scoreWeights,
  secondaryTables,
  secondaryWeights,
  stabilityTables,
  stabilityWeights,
  type HardPenaltyId,
  type ScoreTable
} from './config';
import { interpolateScore, roundScore } from './stats';
import type {
  AppliedPenalty,
  CompletionInfo,
  ComponentScores,
  Measurements,
  Rating,
  Recommendation,
  SystemInfo
} from './types';

function scoreOrZero(value: number | null | undefined, table: ScoreTable): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return interpolateScore(value, table);
}

export function scoreNetwork(measurements: Measurements): number {
  const n = measurements.network;
  return (
    networkWeights.stability * scoreOrZero(n.failureRate, networkTables.failureRate) +
    networkWeights.latency * scoreOrZero(n.latencyMedianMs, networkTables.latencyMs) +
    networkWeights.jitter * scoreOrZero(n.jitterMs, networkTables.jitterMs) +
    networkWeights.p95 * scoreOrZero(n.latencyP95Ms, networkTables.p95Ms) +
    networkWeights.upload * scoreOrZero(n.uploadMbps, networkTables.uploadMbps) +
    networkWeights.download * scoreOrZero(n.downloadMbps, networkTables.downloadMbps)
  );
}

export function scoreCpu(measurements: Measurements): number {
  const c = measurements.cpu;
  let score =
    cpuWeights.singleThread * scoreOrZero(c.singleThread, cpuTables.singleThreadPerMs) +
    cpuWeights.multiThread * scoreOrZero(c.multiThread, cpuTables.multiThreadPerMs) +
    cpuWeights.cores * scoreOrZero(c.workersUsed, cpuTables.logicalProcessors);
  if (c.variance !== null && c.variance > 0.2) score *= 0.75;
  else if (c.variance !== null && c.variance > 0.1) score *= 0.9;
  return score;
}

export function scoreStability(measurements: Measurements): number {
  const s = measurements.stability;
  return (
    stabilityWeights.frameTime * scoreOrZero(s.frameTimeP95Ms, stabilityTables.frameTimeP95Ms) +
    stabilityWeights.stalls * scoreOrZero(s.stallCount, stabilityTables.stallCount) +
    stabilityWeights.cpuVariance *
      scoreOrZero(measurements.cpu.variance, stabilityTables.cpuVariance)
  );
}

export function scoreSecondary(
  measurements: Measurements,
  system: SystemInfo,
  completion: CompletionInfo
): number {
  const memory = scoreOrZero(system.deviceMemoryGB, secondaryTables.deviceMemoryGB);
  const gpuAdequacy =
    measurements.stability.gpuApi === 'none' || measurements.stability.gpuFrameMs === null
      ? 40
      : interpolateScore(measurements.stability.gpuFrameMs, secondaryTables.gpuFrameMs);
  const gpuInfo = system.gpuSource === 'reported' ? 100 : 55;
  const completeness =
    (completion.cpu === 'ok' ? 40 : 0) +
    (completion.network === 'ok' ? 40 : 0) +
    (completion.stability === 'ok' ? 20 : 0);
  return (
    secondaryWeights.memory * memory +
    secondaryWeights.gpuAdequacy * gpuAdequacy +
    secondaryWeights.gpuInfo * gpuInfo +
    secondaryWeights.completeness * completeness
  );
}

function penalty(id: HardPenaltyId): AppliedPenalty {
  const rule = hardPenaltyRules.find((entry) => entry.id === id);
  if (!rule) throw new Error(`unknown penalty ${id}`);
  return { id, amount: rule.amount, message: rule.message };
}

export function collectPenalties(
  measurements: Measurements,
  completion: CompletionInfo
): AppliedPenalty[] {
  const n = measurements.network;
  const applied: AppliedPenalty[] = [];
  const failure = n.failureRate ?? (completion.network === 'failed' ? 1 : 0);
  const triggers = hardPenaltyTriggers;

  if (failure >= triggers.netFailSevere) applied.push(penalty('net-fail-severe'));
  else if (failure >= triggers.netFailHigh) applied.push(penalty('net-fail-high'));
  else if (failure >= triggers.netFailModerate) applied.push(penalty('net-fail-moderate'));

  if (n.jitterMs !== null) {
    if (n.jitterMs >= triggers.jitterExtremeMs) applied.push(penalty('jitter-extreme'));
    else if (n.jitterMs >= triggers.jitterHighMs) applied.push(penalty('jitter-high'));
  }

  if (n.latencyMedianMs !== null) {
    if (n.latencyMedianMs >= triggers.latencyExtremeMs) applied.push(penalty('latency-extreme'));
    else if (n.latencyMedianMs >= triggers.latencyHighMs) applied.push(penalty('latency-high'));
  }

  if (completion.cpu === 'failed') applied.push(penalty('cpu-failed'));
  if (completion.network === 'failed') applied.push(penalty('network-failed'));

  const variance = measurements.cpu.variance;
  const frameP95 = measurements.stability.frameTimeP95Ms;
  const unstable =
    (variance !== null && variance > triggers.unstableVariance) ||
    (frameP95 !== null &&
      frameP95 > triggers.unstableFrameP95Ms &&
      variance !== null &&
      variance > triggers.unstableFrameVariance);
  if (unstable) applied.push(penalty('unstable-bench'));

  return applied;
}

export function computeScores(
  measurements: Measurements,
  system: SystemInfo,
  completion: CompletionInfo
): { scores: ComponentScores; penalties: AppliedPenalty[] } {
  const network = scoreNetwork(measurements);
  const cpu = scoreCpu(measurements);
  const stability = scoreStability(measurements);
  const secondary = scoreSecondary(measurements, system, completion);
  const penalties = collectPenalties(measurements, completion);
  const penaltyTotal = penalties.reduce((sum, p) => sum + p.amount, 0);
  const overall =
    scoreWeights.network * network +
    scoreWeights.cpu * cpu +
    scoreWeights.stability * stability +
    scoreWeights.secondary * secondary -
    penaltyTotal;
  return {
    scores: {
      network: roundScore(network),
      cpu: roundScore(cpu),
      stability: roundScore(stability),
      secondary: roundScore(secondary),
      overall: roundScore(overall)
    },
    penalties
  };
}

export function ratingFromOverall(overall: number): Rating {
  if (overall >= ratingThresholds.excellent) return 'excellent';
  if (overall >= ratingThresholds.strong) return 'strong';
  if (overall >= ratingThresholds.acceptable) return 'acceptable';
  if (overall >= ratingThresholds.weak) return 'weak';
  return 'poor';
}

export function classifyRecommendation(
  scores: ComponentScores,
  measurements: Measurements,
  completion: CompletionInfo,
  penalties: AppliedPenalty[]
): Recommendation {
  const avoidPenalty = penalties.some(
    (p) => hardPenaltyRules.find((rule) => rule.id === p.id)?.avoid
  );
  const failure = measurements.network.failureRate ?? 0;
  const jitter = measurements.network.jitterMs ?? 0;
  const latency = measurements.network.latencyMedianMs ?? 0;
  const importantFailed = completion.cpu === 'failed' || completion.network === 'failed';
  const thresholds = recommendationThresholds;

  if (
    avoidPenalty ||
    importantFailed ||
    scores.overall < thresholds.avoidOverall ||
    scores.network < thresholds.avoidNetwork ||
    failure >= 0.05 ||
    jitter >= 25 ||
    latency >= 150
  ) {
    return 'avoid';
  }
  if (scores.overall >= thresholds.primaryOverall && scores.network >= thresholds.primaryNetwork) {
    return 'primary';
  }
  if (scores.overall >= thresholds.backupOverall && scores.network >= thresholds.backupNetwork) {
    return 'backup';
  }
  return 'avoid';
}
