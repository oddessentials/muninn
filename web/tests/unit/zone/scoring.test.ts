import { describe, expect, it } from 'vitest';
import {
  classifyRecommendation,
  computeScores,
  ratingFromOverall,
  scoreCpu,
  scoreNetwork
} from '$lib/zone/scoring';
import { defaultCompletion, defaultSystem, makeMeasurements, makeResult } from './fixtures';

describe('network scoring', () => {
  it('prefers a stable modest uplink over gigabit with poor latency and jitter', () => {
    const stable = scoreNetwork(
      makeMeasurements({
        network: {
          latencyMedianMs: 18,
          latencyP95Ms: 24,
          jitterMs: 2,
          uploadMbps: 25,
          downloadMbps: 40,
          failureRate: 0
        }
      })
    );
    const gigabit = scoreNetwork(
      makeMeasurements({
        network: {
          latencyMedianMs: 80,
          latencyP95Ms: 110,
          jitterMs: 20,
          uploadMbps: 900,
          downloadMbps: 1200,
          failureRate: 0
        }
      })
    );
    expect(stable).toBeGreaterThan(gigabit + 20);
  });

  it('awards no meaningful extra points from hundreds of Mbps to gigabit', () => {
    const fast = scoreNetwork(
      makeMeasurements({
        network: {
          uploadMbps: 200,
          downloadMbps: 400,
          latencyMedianMs: 18,
          jitterMs: 2,
          latencyP95Ms: 25,
          failureRate: 0
        }
      })
    );
    const gigabit = scoreNetwork(
      makeMeasurements({
        network: {
          uploadMbps: 1000,
          downloadMbps: 2000,
          latencyMedianMs: 18,
          jitterMs: 2,
          latencyP95Ms: 25,
          failureRate: 0
        }
      })
    );
    expect(Math.abs(fast - gigabit)).toBeLessThan(2);
  });

  it('penalizes failures more than raw bandwidth helps', () => {
    const failing = makeResult({
      name: 'Unstable',
      measurements: makeMeasurements({
        network: {
          latencyMedianMs: 12,
          latencyP95Ms: 18,
          jitterMs: 1.5,
          uploadMbps: 500,
          downloadMbps: 800,
          failureRate: 0.16,
          failedRequests: 4,
          totalRequests: 25
        }
      })
    });
    const modest = makeResult({
      name: 'Steady',
      measurements: makeMeasurements({
        network: {
          latencyMedianMs: 22,
          latencyP95Ms: 30,
          jitterMs: 3,
          uploadMbps: 18,
          downloadMbps: 40,
          failureRate: 0
        }
      })
    });
    expect(modest.scores.overall).toBeGreaterThan(failing.scores.overall);
    expect(
      classifyRecommendation(
        failing.scores,
        failing.measurements,
        failing.completion,
        failing.penalties
      )
    ).toBe('avoid');
  });
});

describe('cpu scoring', () => {
  it('weights measured single-thread performance far above core count', () => {
    const strongSingle = scoreCpu(
      makeMeasurements({
        cpu: { singleThread: 455000, multiThread: 910000, workersUsed: 4, variance: 0.02 }
      })
    );
    const manyWeakCores = scoreCpu(
      makeMeasurements({
        cpu: { singleThread: 108000, multiThread: 2600000, workersUsed: 16, variance: 0.02 }
      })
    );
    expect(strongSingle).toBeGreaterThan(manyWeakCores + 15);
  });

  it('ignores hardware marketing names', () => {
    const measuredFast = makeResult({
      name: 'Ryzen5',
      measurements: makeMeasurements({
        cpu: { singleThread: 368000, multiThread: 1520000, workersUsed: 6 }
      })
    });
    const bigName = makeResult({
      name: 'Ryzen9',
      measurements: makeMeasurements({
        cpu: { singleThread: 238000, multiThread: 3030000, workersUsed: 16 }
      }),
      system: { gpuRenderer: 'NVIDIA GeForce RTX 4090' }
    });
    expect(measuredFast.scores.cpu).toBeGreaterThan(bigName.scores.cpu);
    expect(measuredFast.scores.overall).toBeGreaterThan(bigName.scores.overall);
  });
});

describe('overall score and rating', () => {
  it('produces a 0 to 100 integer overall score', () => {
    const result = makeResult({ name: 'Pete' });
    expect(Number.isInteger(result.scores.overall)).toBe(true);
    expect(result.scores.overall).toBeGreaterThanOrEqual(0);
    expect(result.scores.overall).toBeLessThanOrEqual(100);
    expect(result.rating).toBe(ratingFromOverall(result.scores.overall));
  });

  it('maps rating bands', () => {
    expect(ratingFromOverall(95)).toBe('excellent');
    expect(ratingFromOverall(80)).toBe('strong');
    expect(ratingFromOverall(66)).toBe('acceptable');
    expect(ratingFromOverall(45)).toBe('weak');
    expect(ratingFromOverall(10)).toBe('poor');
  });

  it('applies hard penalties for extreme latency and jitter', () => {
    const clean = computeScores(makeMeasurements(), defaultSystem, defaultCompletion);
    const spiked = computeScores(
      makeMeasurements({
        network: { latencyMedianMs: 210, latencyP95Ms: 280, jitterMs: 48, failureRate: 0 }
      }),
      defaultSystem,
      defaultCompletion
    );
    expect(spiked.penalties.map((p) => p.id)).toEqual(
      expect.arrayContaining(['latency-extreme', 'jitter-extreme'])
    );
    expect(spiked.scores.overall).toBeLessThan(clean.scores.overall - 30);
  });

  it('keeps excellent hardware from ranking highly with unstable networking', () => {
    const result = makeResult({
      name: 'John',
      measurements: makeMeasurements({
        cpu: { singleThread: 562000, multiThread: 3460000, workersUsed: 16, variance: 0.015 },
        network: {
          latencyMedianMs: 35,
          latencyP95Ms: 95,
          jitterMs: 28,
          uploadMbps: 400,
          downloadMbps: 900,
          failureRate: 0.09,
          failedRequests: 2,
          totalRequests: 22
        }
      })
    });
    expect(
      classifyRecommendation(
        result.scores,
        result.measurements,
        result.completion,
        result.penalties
      )
    ).toBe('avoid');
  });
});
