import { computeScores, ratingFromOverall } from './scoring';
import type {
  CompletionInfo,
  DiagnosticResult,
  DiagnosticTarget,
  Measurements,
  SystemInfo
} from './types';
import { diagnosticVersion, schemaVersion } from './version';

export function buildDiagnosticResult(input: {
  playerName: string;
  testedAt?: string;
  diagnosticTarget: DiagnosticTarget;
  system: SystemInfo;
  measurements: Measurements;
  completion: CompletionInfo;
}): DiagnosticResult {
  const { scores, penalties } = computeScores(input.measurements, input.system, input.completion);
  return {
    schemaVersion,
    diagnosticVersion,
    player: { name: input.playerName.trim() },
    testedAt: input.testedAt ?? new Date().toISOString(),
    diagnosticTarget: input.diagnosticTarget,
    system: input.system,
    measurements: input.measurements,
    scores,
    rating: ratingFromOverall(scores.overall),
    penalties,
    completion: input.completion
  };
}
