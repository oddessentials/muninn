import type {
  ZoneCompletion,
  ZoneCpu,
  ZoneExplanation,
  ZoneMeasurements,
  ZoneNetwork,
  ZonePenalty,
  ZoneRating,
  ZoneRecommendation,
  ZoneResult,
  ZoneScores,
  ZoneStability,
  ZoneSystem,
  ZoneTarget,
  ZoneTestStatus,
  ZoneValueSource
} from '$lib/api/types';

export type Rating = ZoneRating;
export type Recommendation = ZoneRecommendation;
export type TestStatus = ZoneTestStatus;
export type ValueSource = ZoneValueSource;
export type DiagnosticTarget = ZoneTarget;
export type SystemInfo = ZoneSystem;
export type CpuMeasurements = ZoneCpu;
export type NetworkMeasurements = ZoneNetwork;
export type StabilityMeasurements = ZoneStability;
export type Measurements = ZoneMeasurements;
export type ComponentScores = ZoneScores;
export type CompletionInfo = ZoneCompletion;
export type AppliedPenalty = ZonePenalty;
export type DiagnosticResult = ZoneResult;
export type PlayerExplanation = ZoneExplanation;

export interface RankedResult {
  rank: number;
  result: DiagnosticResult;
  recommendation: Recommendation;
  explanation: PlayerExplanation;
}
