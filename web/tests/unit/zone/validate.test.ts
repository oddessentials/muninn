import { describe, expect, it } from 'vitest';
import { resultFilename, serializeResult } from '$lib/zone/download';
import type { DiagnosticResult } from '$lib/zone/types';
import { checkResult } from '$lib/zone/validate';
import { diagnosticVersion } from '$lib/zone/version';
import { makeResult } from './fixtures';

function roundTrip(result: DiagnosticResult): DiagnosticResult {
  return JSON.parse(serializeResult(result)) as DiagnosticResult;
}

describe('result checks and versioning', () => {
  it('accepts a well-formed current result without changing it', () => {
    const result = makeResult({ name: 'Pete' });
    const checked = checkResult(roundTrip(result));
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.tampered).toBe(false);
    expect(checked.result).toEqual(result);
    expect(checked.result.diagnosticVersion).toBe(diagnosticVersion);
  });

  it('rejects incompatible diagnostic versions and accepts patch releases', () => {
    const incompatible = { ...makeResult({ name: 'Pete' }), diagnosticVersion: '2.0.0' };
    const rejected = checkResult(incompatible);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.code).toBe('incompatible-version');
    const patch = { ...makeResult({ name: 'Pete' }), diagnosticVersion: '1.1.9' };
    expect(checkResult(patch).ok).toBe(true);
    const earlier = { ...makeResult({ name: 'Pete' }), diagnosticVersion: '1.0.0' };
    expect(checkResult(earlier).ok).toBe(false);
  });

  it('rejects incomplete diagnostics', () => {
    const base = makeResult({ name: 'Pete' });
    const incomplete = makeResult({
      name: 'Pete',
      completion: { cpu: 'failed', network: 'ok' },
      measurements: {
        ...base.measurements,
        cpu: { ...base.measurements.cpu, singleThread: null }
      }
    });
    const checked = checkResult(incomplete);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.code).toBe('incomplete');
    const interrupted = makeResult({ name: 'Pete', completion: { interrupted: true } });
    const rejected = checkResult(interrupted);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.message).toMatch(/interrupted/);
  });

  it('rejects impossible values', () => {
    const raw = roundTrip(makeResult({ name: 'Pete' }));
    raw.measurements.network.failureRate = 4;
    const checked = checkResult(raw);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.code).toBe('impossible');
    const backwards = roundTrip(makeResult({ name: 'Pete' }));
    backwards.measurements.network.latencyP95Ms = 5;
    expect(checkResult(backwards).ok).toBe(false);
  });

  it('accepts a multi-thread throughput below the single-thread one', () => {
    const contended = roundTrip(makeResult({ name: 'Pete' }));
    contended.measurements.cpu.multiThread = Math.round(
      (contended.measurements.cpu.singleThread ?? 0) * 0.8
    );
    expect(checkResult(contended).ok).toBe(true);
    const negative = roundTrip(makeResult({ name: 'Pete' }));
    negative.measurements.cpu.multiThread = -1;
    expect(checkResult(negative).ok).toBe(false);
  });

  it('flags tampered scores and recomputes them from the measurements', () => {
    const raw = roundTrip(makeResult({ name: 'Pete' }));
    raw.scores.overall = 100;
    raw.scores.network = 100;
    raw.scores.cpu = 100;
    raw.rating = 'excellent';
    const checked = checkResult(raw);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.tampered).toBe(true);
    expect(checked.result.scores).toEqual(makeResult({ name: 'Pete' }).scores);
    expect(checked.result.rating).toBe(makeResult({ name: 'Pete' }).rating);
  });
});

describe('download format', () => {
  it('uses a safe dated filename', () => {
    expect(resultFilename('Pete', '2026-09-10T15:32:41.000Z')).toBe(
      'zone-leader-pete-2026-09-10.json'
    );
    expect(resultFilename('OLAF THE RED', '2026-09-11T00:00:00.000Z')).toBe(
      'zone-leader-olaf-the-red-2026-09-11.json'
    );
  });

  it('round-trips the required export fields', () => {
    const parsed = roundTrip(makeResult({ name: 'Pete' }));
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.diagnosticVersion).toBe(diagnosticVersion);
    expect(parsed.player.name).toBe('Pete');
    expect(parsed.diagnosticTarget.endpoint).toContain('/api/v1/zone/probe');
    expect(parsed.measurements.cpu.singleThread).toBe(390000);
    expect(parsed.scores.overall).toBeGreaterThanOrEqual(0);
    expect(parsed.completion.cpu).toBe('ok');
  });
});
