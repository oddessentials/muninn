import { describe, expect, it } from 'vitest';
import { explainResult, recommendationFor } from '$lib/zone/explain';
import { makeMeasurements, makeResult } from './fixtures';

describe('deterministic explanations', () => {
  it('explains a strong candidate from measurements', () => {
    const pete = makeResult({ name: 'Pete' });
    const recommendation = recommendationFor(pete);
    const once = explainResult(pete, recommendation);
    const twice = explainResult(pete, recommendation);
    expect(once).toEqual(twice);
    expect(recommendation).toBe('primary');
    expect(once.reason).toMatch(/zone/i);
    expect(once.summary).toContain('Pete');
  });

  it('calls out jitter and spikes for an avoid candidate', () => {
    const john = makeResult({
      name: 'John',
      measurements: makeMeasurements({
        cpu: { singleThread: 520000, multiThread: 3030000, workersUsed: 12 },
        network: {
          latencyMedianMs: 42,
          latencyP95Ms: 110,
          jitterMs: 29,
          uploadMbps: 300,
          failureRate: 0.08,
          failedRequests: 2,
          totalRequests: 25
        }
      })
    });
    const recommendation = recommendationFor(john);
    const explanation = explainResult(john, recommendation);
    expect(recommendation).toBe('avoid');
    expect(explanation.reason).toMatch(/jitter|failure|connection|ownership/i);
    expect(explanation.limiting.length).toBeGreaterThanOrEqual(1);
  });

  it('mentions a lost tab focus as a limiting factor', () => {
    const result = makeResult({ name: 'Tabby', completion: { tabLostFocus: true } });
    expect(explainResult(result).limiting).toContain(
      'The browser tab lost focus during the run, which can distort measurements.'
    );
  });
});
