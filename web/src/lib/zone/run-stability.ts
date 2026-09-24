import { benchmark } from './config';
import { median, percentile } from './stats';
import type { StabilityMeasurements, TestStatus } from './types';

export interface StabilityBenchmark {
  measurements: StabilityMeasurements;
  status: TestStatus;
  warning?: string;
}

function waitFrames(count: number, limitMs: number): Promise<number[]> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let last = performance.now();
    let remaining = count;
    let handle = 0;
    const limit = window.setTimeout(() => {
      cancelAnimationFrame(handle);
      resolve(deltas);
    }, limitMs);
    const tick = (now: number) => {
      deltas.push(now - last);
      last = now;
      remaining -= 1;
      if (remaining <= 0) {
        window.clearTimeout(limit);
        resolve(deltas);
      } else handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
  });
}

function measureGpu(): { gpuFrameMs: number | null; gpuApi: StabilityMeasurements['gpuApi'] } {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const webgl2 = canvas.getContext('webgl2');
  const gl = webgl2 ?? canvas.getContext('webgl');
  if (!gl) return { gpuFrameMs: null, gpuApi: 'none' };
  const gpuApi = webgl2 ? 'webgl2' : 'webgl';
  try {
    gl.viewport(0, 0, canvas.width, canvas.height);
    const frames = benchmark.gpuFrames;
    const start = performance.now();
    for (let i = 0; i < frames; i++) {
      const t = i / frames;
      gl.clearColor(t * 0.2, 0.08, 0.1 + t * 0.15, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.flush();
    }
    gl.finish();
    return { gpuFrameMs: (performance.now() - start) / frames, gpuApi };
  } catch {
    return { gpuFrameMs: null, gpuApi };
  }
}

export async function runStabilityBenchmark(): Promise<StabilityBenchmark> {
  if (typeof requestAnimationFrame === 'undefined') {
    return {
      measurements: {
        frameTimeP95Ms: null,
        frameTimeMedianMs: null,
        stallCount: null,
        gpuFrameMs: null,
        gpuApi: 'none'
      },
      status: 'failed',
      warning: 'Frame timing is unavailable in this browser.'
    };
  }
  const deltas = await waitFrames(benchmark.frameSampleCount, benchmark.frameSampleLimitMs);
  const usable = deltas.slice(5);
  const p95 = percentile(usable, 0.95);
  const med = median(usable);
  const stalls = usable.filter((d) => d >= benchmark.stallFrameMs).length;
  const gpu = measureGpu();
  return {
    measurements: {
      frameTimeP95Ms: p95 === null ? null : Number(p95.toFixed(2)),
      frameTimeMedianMs: med === null ? null : Number(med.toFixed(2)),
      stallCount: stalls,
      gpuFrameMs: gpu.gpuFrameMs === null ? null : Number(gpu.gpuFrameMs.toFixed(2)),
      gpuApi: gpu.gpuApi
    },
    status: p95 === null ? 'failed' : 'ok',
    warning:
      stalls >= 4
        ? 'Several long frames were observed. Power saving or a backgrounded tab may have interfered.'
        : undefined
  };
}
