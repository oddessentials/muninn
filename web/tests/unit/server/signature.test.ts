import { describe, expect, it } from 'vitest';
import {
  signBatch,
  signMap,
  verifyBatchSignature,
  verifyMapSignature
} from '$lib/server/ingest/signature';

const secret = 'test-secret';
const body = Buffer.from('{"events":[]}');

describe('telemetry signatures', () => {
  it('accepts a correctly signed batch inside the window', () => {
    const now = 1_757_534_400;
    const signature = signBatch(secret, now - 100, body);
    expect(verifyBatchSignature(secret, String(now - 100), signature, body, now).ok).toBe(true);
  });

  it('rejects stale timestamps, bad signatures and malformed headers', () => {
    const now = 1_757_534_400;
    const signature = signBatch(secret, now - 400, body);
    expect(verifyBatchSignature(secret, String(now - 400), signature, body, now).failure).toBe(
      'stale_timestamp'
    );
    const fresh = signBatch(secret, now, body);
    expect(
      verifyBatchSignature(secret, String(now), fresh, Buffer.from('{"events":[1]}'), now).failure
    ).toBe('bad_signature');
    expect(verifyBatchSignature('other', String(now), fresh, body, now).failure).toBe(
      'bad_signature'
    );
    expect(verifyBatchSignature(secret, null, fresh, body, now).failure).toBe('missing_timestamp');
    expect(verifyBatchSignature(secret, String(now), 'sha256=zz', body, now).failure).toBe(
      'malformed_signature'
    );
  });

  it('signs map uploads over the body digest', () => {
    const now = 1_757_534_400;
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const signature = signMap(secret, now, png);
    expect(verifyMapSignature(secret, String(now), signature, png, now).ok).toBe(true);
    expect(verifyMapSignature(secret, String(now), signature, Buffer.from('x'), now).ok).toBe(
      false
    );
  });
});
