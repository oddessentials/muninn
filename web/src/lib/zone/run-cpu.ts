import { benchmark } from './config';
import { cpuWorkSeed, runCpuBurst } from './cpu-work';
import type { CpuWorkReply, CpuWorkRequest } from './cpu.worker';
import { coefficientOfVariation, median } from './stats';
import type { CpuMeasurements, TestStatus } from './types';
import { cpuKernelId } from './version';

export interface CpuBenchmark {
  measurements: CpuMeasurements;
  status: TestStatus;
  warning?: string;
}

function spawnWorker(): Worker {
  return new Worker(new URL('./cpu.worker.ts', import.meta.url), { type: 'module' });
}

function runOnWorker(worker: Worker, durationMs: number, seed: number): Promise<CpuWorkReply> {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const timer = window.setTimeout(() => {
      worker.removeEventListener('message', onMessage);
      reject(new Error('CPU worker timed out'));
    }, durationMs + 4000);
    function onMessage(event: MessageEvent<CpuWorkReply>) {
      if (event.data.id !== id) return;
      window.clearTimeout(timer);
      worker.removeEventListener('message', onMessage);
      resolve(event.data);
    }
    worker.addEventListener('message', onMessage);
    const request: CpuWorkRequest = { id, durationMs, seed };
    worker.postMessage(request);
  });
}

async function runBurst(worker: Worker | null, durationMs: number, seed: number): Promise<number> {
  if (worker) return (await runOnWorker(worker, durationMs, seed)).throughput;
  return runCpuBurst(durationMs, seed).throughput;
}

export async function runCpuBenchmark(onTick?: (label: string) => void): Promise<CpuBenchmark> {
  let workers: Worker[] = [];
  const mainThreadOnly = typeof Worker === 'undefined';
  try {
    const concurrency =
      typeof navigator !== 'undefined' && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 2;
    const workerCount = Math.max(1, Math.min(concurrency, benchmark.cpuMaxWorkers));
    if (!mainThreadOnly) workers = Array.from({ length: workerCount }, () => spawnWorker());
    const primary = workers[0] ?? null;

    onTick?.('Warming up the CPU');
    await runBurst(primary, benchmark.cpuWarmupMs, cpuWorkSeed);

    const samples: number[] = [];
    for (let i = 0; i < benchmark.cpuSingleSamples; i++) {
      onTick?.(`Single-thread sample ${i + 1} of ${benchmark.cpuSingleSamples}`);
      samples.push(await runBurst(primary, benchmark.cpuSampleMs, cpuWorkSeed + i + 1));
    }
    const singleThread = median(samples);

    onTick?.('Multi-thread pass');
    if (workers.length > 1) {
      await Promise.all(
        workers.map((worker, index) =>
          runBurst(worker, Math.round(benchmark.cpuWarmupMs * 0.7), cpuWorkSeed + 40 + index)
        )
      );
    }
    const multiSamples: number[] = [];
    for (let i = 0; i < benchmark.cpuMultiSamples; i++) {
      onTick?.(`Multi-thread sample ${i + 1} of ${benchmark.cpuMultiSamples}`);
      if (workers.length === 0) {
        multiSamples.push(await runBurst(null, benchmark.cpuSampleMs, cpuWorkSeed + 80 + i));
      } else {
        const parts = await Promise.all(
          workers.map((worker, index) =>
            runBurst(worker, benchmark.cpuSampleMs, cpuWorkSeed + 80 + i * 16 + index)
          )
        );
        multiSamples.push(parts.reduce((sum, n) => sum + n, 0));
      }
    }
    const multiThread = median(multiSamples);
    const variance = coefficientOfVariation(samples);

    return {
      measurements: {
        singleThread: singleThread === null ? null : Math.round(singleThread),
        multiThread: multiThread === null ? null : Math.round(multiThread),
        variance: variance === null ? null : Number(variance.toFixed(4)),
        samples: samples.map((n) => Math.round(n)),
        workersUsed: mainThreadOnly ? 1 : workers.length,
        kernel: cpuKernelId
      },
      status: singleThread === null ? 'failed' : 'ok',
      warning: mainThreadOnly
        ? 'CPU work ran on the main thread because Web Workers are unavailable.'
        : undefined
    };
  } catch {
    return {
      measurements: {
        singleThread: null,
        multiThread: null,
        variance: null,
        samples: [],
        workersUsed: workers.length || null,
        kernel: cpuKernelId
      },
      status: 'failed',
      warning: 'The CPU benchmark failed to complete.'
    };
  } finally {
    for (const worker of workers) worker.terminate();
  }
}
