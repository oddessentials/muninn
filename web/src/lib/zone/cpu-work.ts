import { benchmark } from './config';

export const cpuWorkSeed = 0x9e3779b9;

export function cpuKernel(iterations: number, seed: number): number {
  let a = seed | 0;
  let b = 0x85ebca6b;
  let acc = 0;
  const table = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    a = Math.imul(a ^ (a >>> 16), 0x7feb352d);
    a = Math.imul(a ^ (a >>> 15), 0x846ca68b);
    table[i] = a ^ (a >>> 16);
  }
  a = seed | 0;
  for (let i = 0; i < iterations; i++) {
    a = (Math.imul(a, 1664525) + 1013904223) | 0;
    b = (b + (table[a & 63] as number)) | 0;
    acc = (acc + Math.imul(a ^ b, cpuWorkSeed)) | 0;
    const rot = (a << 13) | (a >>> 19);
    a = (rot ^ b) | 0;
    if ((i & 7) === 0) acc = (acc + (table[(acc >>> 2) & 63] as number)) | 0;
  }
  return acc | 0;
}

export interface CpuBurstResult {
  iterations: number;
  elapsedMs: number;
  checksum: number;
  throughput: number;
}

export function runCpuBurst(durationMs: number, seed: number): CpuBurstResult {
  const batch = benchmark.cpuBatchIterations;
  const start = performance.now();
  let iterations = 0;
  let checksum = 0;
  let s = seed | 0;
  while (performance.now() - start < durationMs) {
    checksum = cpuKernel(batch, s);
    s = (s + 1) | 0;
    iterations += batch;
  }
  const elapsedMs = performance.now() - start;
  return {
    iterations,
    elapsedMs,
    checksum,
    throughput: elapsedMs > 0 ? iterations / elapsedMs : 0
  };
}
