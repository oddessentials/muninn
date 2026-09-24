import { describe, expect, it } from 'vitest';
import { ApiHttpError } from '$lib/server/http/respond';
import {
  countUploadBytes,
  parseProbeBytes,
  patternBytes,
  probeMaxBytes,
  probeMinBytes
} from '$lib/server/zone/probe';

function url(query: string): URL {
  return new URL(`http://probe/api/v1/zone/probe/download${query}`);
}

describe('zone probe', () => {
  it('clamps the requested download size and defaults it', () => {
    expect(parseProbeBytes(url(''))).toBe(65536);
    expect(parseProbeBytes(url('?bytes=1000'))).toBe(1000);
    expect(parseProbeBytes(url('?bytes=1'))).toBe(probeMinBytes);
    expect(parseProbeBytes(url('?bytes=99999999'))).toBe(probeMaxBytes);
    expect(parseProbeBytes(url('?bytes=100.9'))).toBe(100);
    expect(() => parseProbeBytes(url('?bytes=lots'))).toThrow(ApiHttpError);
  });

  it('produces a deterministic payload of the requested size', () => {
    const a = patternBytes(4096);
    const b = patternBytes(4096);
    expect(a.byteLength).toBe(4096);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(new Set(a.slice(0, 256)).size).toBeGreaterThan(64);
  });

  it('counts uploaded bytes and refuses bodies over the cap', async () => {
    const small = new Request('http://probe/upload', {
      method: 'POST',
      body: new Uint8Array(1234),
      headers: { 'content-type': 'application/octet-stream' }
    });
    expect(await countUploadBytes(small)).toBe(1234);
    const declared = new Request('http://probe/upload', {
      method: 'POST',
      body: new Uint8Array(16),
      headers: { 'content-length': String(probeMaxBytes + 1) }
    });
    await expect(countUploadBytes(declared)).rejects.toMatchObject({ status: 413 });
    const streamed = new Request('http://probe/upload', {
      method: 'POST',
      body: new Uint8Array(probeMaxBytes + 1),
      headers: { 'content-type': 'application/octet-stream' }
    });
    await expect(countUploadBytes(streamed)).rejects.toMatchObject({ status: 413 });
  });
});
