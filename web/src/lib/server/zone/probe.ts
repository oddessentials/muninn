import type { ProbeHealth } from '$lib/api/types';
import { diagnosticVersion } from '$lib/zone/version';
import { badRequest, noStore, payloadTooLarge } from '../http/respond';

export const probeMinBytes = 16;
export const probeMaxBytes = 2 * 1024 * 1024;
export const probeDefaultBytes = 65536;

export const probeHealth: ProbeHealth = {
  ok: true,
  service: 'valheim-zone-probe',
  version: diagnosticVersion
};

export function probeJson(document: unknown, status = 200): Response {
  return new Response(JSON.stringify(document), {
    status,
    headers: { 'content-type': 'application/json', ...noStore }
  });
}

export function parseProbeBytes(url: URL): number {
  const raw = url.searchParams.get('bytes');
  if (raw === null || raw === '') return probeDefaultBytes;
  const requested = Number(raw);
  if (!Number.isFinite(requested)) throw badRequest('bytes must be a number');
  return Math.max(probeMinBytes, Math.min(probeMaxBytes, Math.floor(requested)));
}

export function patternBytes(size: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  let x = 0x6d2b79f5;
  for (let i = 0; i < size; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    bytes[i] = x & 255;
  }
  return bytes;
}

export async function countUploadBytes(request: Request): Promise<number> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > probeMaxBytes) throw payloadTooLarge('body over 2 MiB');
  let received = 0;
  const body = request.body;
  if (!body) return 0;
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > probeMaxBytes) {
        await reader.cancel();
        throw payloadTooLarge('body over 2 MiB');
      }
    }
  } finally {
    reader.releaseLock();
  }
  return received;
}
