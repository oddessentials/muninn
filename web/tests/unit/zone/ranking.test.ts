import { describe, expect, it } from 'vitest';
import { compareZoneLeaders, rankResults } from '$lib/zone/ranking';
import type { DiagnosticResult } from '$lib/zone/types';
import { makeMeasurements, makeResult } from './fixtures';

function withScoresOf(base: DiagnosticResult, result: DiagnosticResult): DiagnosticResult {
  return { ...result, scores: { ...base.scores } };
}

describe('ranking', () => {
  it('ranks primarily by overall score', () => {
    const pete = makeResult({
      name: 'Pete',
      measurements: makeMeasurements({
        network: { latencyMedianMs: 16, jitterMs: 1.8, latencyP95Ms: 22, failureRate: 0 }
      })
    });
    const dave = makeResult({
      name: 'Dave',
      measurements: makeMeasurements({
        cpu: { singleThread: 195000, multiThread: 650000, workersUsed: 4 },
        network: { latencyMedianMs: 40, jitterMs: 8, latencyP95Ms: 58, uploadMbps: 12 }
      })
    });
    const ranked = rankResults([dave, pete]);
    expect(ranked.map((entry) => entry.result.player.name)).toEqual(['Pete', 'Dave']);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2]);
  });

  it('breaks overall ties by failures, then latency, then jitter, then single-thread CPU', () => {
    const base = makeResult({ name: 'Base' });
    const unstable = withScoresOf(
      base,
      makeResult({
        name: 'Unstable',
        measurements: makeMeasurements({
          network: { failureRate: 0.02, failedRequests: 1, totalRequests: 50 }
        })
      })
    );
    const stable = withScoresOf(
      base,
      makeResult({
        name: 'Stable',
        measurements: makeMeasurements({
          network: { failureRate: 0, failedRequests: 0, totalRequests: 50 }
        })
      })
    );
    expect(compareZoneLeaders(stable, unstable)).toBeLessThan(0);

    const lowLatency = withScoresOf(
      base,
      makeResult({
        name: 'LowLat',
        measurements: makeMeasurements({ network: { latencyMedianMs: 16, failureRate: 0 } })
      })
    );
    const highLatency = withScoresOf(
      base,
      makeResult({
        name: 'HighLat',
        measurements: makeMeasurements({ network: { latencyMedianMs: 28, failureRate: 0 } })
      })
    );
    expect(compareZoneLeaders(lowLatency, highLatency)).toBeLessThan(0);

    const lowJitter = withScoresOf(
      base,
      makeResult({
        name: 'LowJit',
        measurements: makeMeasurements({
          network: { latencyMedianMs: 20, jitterMs: 1.5, failureRate: 0 }
        })
      })
    );
    const highJitter = withScoresOf(
      base,
      makeResult({
        name: 'HighJit',
        measurements: makeMeasurements({
          network: { latencyMedianMs: 20, jitterMs: 8, failureRate: 0 }
        })
      })
    );
    expect(compareZoneLeaders(lowJitter, highJitter)).toBeLessThan(0);

    const fastCpu = withScoresOf(
      base,
      makeResult({
        name: 'FastCpu',
        measurements: makeMeasurements({
          network: { latencyMedianMs: 20, jitterMs: 2, failureRate: 0 },
          cpu: { singleThread: 455000 }
        })
      })
    );
    const slowCpu = withScoresOf(
      base,
      makeResult({
        name: 'SlowCpu',
        measurements: makeMeasurements({
          network: { latencyMedianMs: 20, jitterMs: 2, failureRate: 0 },
          cpu: { singleThread: 195000 }
        })
      })
    );
    expect(compareZoneLeaders(fastCpu, slowCpu)).toBeLessThan(0);
  });

  it('classifies primary, backup and avoid recommendations', () => {
    const primary = makeResult({ name: 'Pete' });
    const backup = makeResult({
      name: 'Dave',
      measurements: makeMeasurements({
        cpu: { singleThread: 184000, multiThread: 540000, workersUsed: 4, variance: 0.05 },
        network: {
          latencyMedianMs: 55,
          latencyP95Ms: 78,
          jitterMs: 11,
          uploadMbps: 10,
          downloadMbps: 25,
          failureRate: 0
        },
        stability: { frameTimeP95Ms: 22, stallCount: 2 }
      })
    });
    const avoid = makeResult({
      name: 'John',
      measurements: makeMeasurements({
        network: {
          latencyMedianMs: 90,
          latencyP95Ms: 160,
          jitterMs: 32,
          uploadMbps: 200,
          failureRate: 0.1,
          failedRequests: 3,
          totalRequests: 30
        }
      })
    });
    const ranked = rankResults([backup, avoid, primary]);
    const recommendationOf = (name: string) =>
      ranked.find((entry) => entry.result.player.name === name)?.recommendation;
    expect(recommendationOf('Pete')).toBe('primary');
    expect(recommendationOf('Dave')).toBe('backup');
    expect(recommendationOf('John')).toBe('avoid');
  });

  it('ranks ten players in order with an explanation each', () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      makeResult({
        name: `Player${i + 1}`,
        testedAt: `2026-09-10T15:${String(i).padStart(2, '0')}:00.000Z`,
        measurements: makeMeasurements({
          network: {
            latencyMedianMs: 16 + i * 6,
            latencyP95Ms: 24 + i * 8,
            jitterMs: 2 + i * 0.8,
            uploadMbps: 40 - i,
            failureRate: i === 9 ? 0.12 : 0
          },
          cpu: {
            singleThread: 433000 - i * 17300,
            multiThread: 1730000 - i * 43000,
            workersUsed: 8
          }
        })
      })
    );
    const ranked = rankResults([...results].reverse());
    expect(ranked).toHaveLength(10);
    expect(ranked[0]?.result.player.name).toBe('Player1');
    expect(ranked[9]?.rank).toBe(10);
    expect(ranked[9]?.recommendation).toBe('avoid');
    for (const entry of ranked) expect(entry.explanation.reason.length).toBeGreaterThan(0);
  });
});
