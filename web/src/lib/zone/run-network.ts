import { benchmark } from './config';
import { mbpsFromBytes, median, percentile, successiveJitter } from './stats';
import type { NetworkMeasurements, TestStatus } from './types';

export interface NetworkBenchmark {
  measurements: NetworkMeasurements;
  status: TestStatus;
  warning?: string;
}

export function probeUrl(base: string, path: string, query?: Record<string, string>): string {
  const url = new URL(`${base.replace(/\/+$/, '')}/${path}`, globalThis.location?.href);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  return url.toString();
}

async function pingOnce(base: string): Promise<{ ok: boolean; rtt: number }> {
  const start = performance.now();
  try {
    const response = await fetch(probeUrl(base, 'ping', { t: String(Date.now()) }), {
      cache: 'no-store',
      signal: AbortSignal.timeout(benchmark.pingTimeoutMs)
    });
    return { ok: response.ok, rtt: performance.now() - start };
  } catch {
    return { ok: false, rtt: performance.now() - start };
  }
}

async function measureDownload(base: string, bytes: number): Promise<number | null> {
  const start = performance.now();
  try {
    const response = await fetch(probeUrl(base, 'download', { bytes: String(bytes) }), {
      cache: 'no-store',
      signal: AbortSignal.timeout(benchmark.throughputTimeoutMs)
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return mbpsFromBytes(buffer.byteLength, performance.now() - start);
  } catch {
    return null;
  }
}

function randomPayload(bytes: number): Uint8Array<ArrayBuffer> {
  const payload = new Uint8Array(bytes);
  const chunk = 65536;
  for (let offset = 0; offset < bytes; offset += chunk) {
    crypto.getRandomValues(payload.subarray(offset, Math.min(offset + chunk, bytes)));
  }
  return payload;
}

async function measureUpload(base: string, bytes: number): Promise<number | null> {
  const body = randomPayload(bytes);
  const start = performance.now();
  try {
    const response = await fetch(probeUrl(base, 'upload'), {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/octet-stream' },
      body,
      signal: AbortSignal.timeout(benchmark.throughputTimeoutMs)
    });
    if (!response.ok) return null;
    await response.arrayBuffer();
    return mbpsFromBytes(bytes, performance.now() - start);
  } catch {
    return null;
  }
}

async function probeReachable(base: string): Promise<boolean> {
  try {
    const health = await fetch(probeUrl(base, 'health'), {
      cache: 'no-store',
      signal: AbortSignal.timeout(benchmark.pingTimeoutMs)
    });
    return health.ok;
  } catch {
    return false;
  }
}

export async function runNetworkBenchmark(
  base: string,
  onTick?: (label: string) => void
): Promise<NetworkBenchmark> {
  onTick?.('Reaching the probe');
  let reachable = await probeReachable(base);

  onTick?.('Measuring latency');
  const rtts: number[] = [];
  let failed = 0;
  let total = 0;
  for (let i = 0; i < benchmark.pingCount; i++) {
    total += 1;
    const sample = await pingOnce(base);
    if (!sample.ok) failed += 1;
    else if (i > 0) rtts.push(sample.rtt);
    if (sample.ok) reachable = true;
  }

  onTick?.('Measuring download');
  const downloads = [
    await measureDownload(base, benchmark.downloadBytes),
    await measureDownload(base, benchmark.downloadBytesLarge)
  ];
  onTick?.('Measuring upload');
  const uploads = [
    await measureUpload(base, benchmark.uploadBytes),
    await measureUpload(base, benchmark.uploadBytesLarge)
  ];
  total += 4;
  failed += downloads.filter((n) => n === null).length + uploads.filter((n) => n === null).length;

  const downloadRates = downloads.filter((n): n is number => n !== null);
  const uploadRates = uploads.filter((n): n is number => n !== null);
  const failureRate = total === 0 ? 1 : failed / total;
  const latencyMedian = median(rtts);
  const latencyP95 = percentile(rtts, 0.95);
  const jitter = successiveJitter(rtts);
  const status: TestStatus =
    rtts.length === 0 && uploadRates.length === 0 && downloadRates.length === 0
      ? 'failed'
      : failureRate > 0.4 || rtts.length < 4
        ? 'partial'
        : 'ok';

  return {
    measurements: {
      latencyMedianMs: latencyMedian === null ? null : Number(latencyMedian.toFixed(2)),
      latencyP95Ms: latencyP95 === null ? null : Number(latencyP95.toFixed(2)),
      jitterMs: jitter === null ? null : Number(jitter.toFixed(2)),
      uploadMbps: uploadRates.length ? Number(Math.max(...uploadRates).toFixed(2)) : null,
      downloadMbps: downloadRates.length ? Number(Math.max(...downloadRates).toFixed(2)) : null,
      failureRate: Number(failureRate.toFixed(4)),
      latencySamplesMs: rtts.map((n) => Number(n.toFixed(2))),
      failedRequests: failed,
      totalRequests: total,
      endpointReachable: reachable
    },
    status,
    warning:
      status === 'failed'
        ? 'The probe could not be reached, so the network was not measured.'
        : status === 'partial'
          ? 'Some network samples failed. The connection may be unstable.'
          : undefined
  };
}
