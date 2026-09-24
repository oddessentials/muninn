import type { ZoneRankedResult, ZoneResult } from '$lib/api/types';
import { rankResults } from '$lib/zone/ranking';
import { normalizeZoneName } from '$lib/zone/stats';
import { checkResult } from '$lib/zone/validate';
import { describeErrors, schemaValidator } from '../ingest/validate';
import { badRequest, unprocessable } from '../http/respond';

export const zoneNameMaxLength = 48;

export function parseZoneName(raw: string | undefined): string {
  const name = normalizeZoneName(raw ?? '');
  if (name.length === 0) throw badRequest('name must not be empty');
  if (name.length > zoneNameMaxLength) {
    throw badRequest(`name must be at most ${zoneNameMaxLength} characters`);
  }
  return name;
}

export function parseZoneResult(body: unknown, name: string, now: Date): ZoneResult {
  const validate = schemaValidator('ZoneResult');
  if (!validate(body)) throw badRequest(`body ${describeErrors(validate.errors)}`);
  const submitted = body as ZoneResult;
  if (normalizeZoneName(submitted.player.name) !== name) {
    throw badRequest(`body names ${submitted.player.name}, not ${name}`);
  }
  const checked = checkResult(submitted);
  if (!checked.ok) throw unprocessable(checked.message);
  return {
    ...checked.result,
    player: { name },
    testedAt: now.toISOString()
  };
}

export function rankZoneResults(results: ZoneResult[]): ZoneRankedResult[] {
  return rankResults(results).map((entry) => ({
    rank: entry.rank,
    name: entry.result.player.name,
    tested_at: entry.result.testedAt,
    rating: entry.result.rating,
    recommendation: entry.recommendation,
    scores: entry.result.scores,
    explanation: entry.explanation,
    result: entry.result
  }));
}
