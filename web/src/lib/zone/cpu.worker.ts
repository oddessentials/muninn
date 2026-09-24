import { runCpuBurst } from './cpu-work';

export interface CpuWorkRequest {
  id: number;
  durationMs: number;
  seed: number;
}

export interface CpuWorkReply {
  id: number;
  iterations: number;
  elapsedMs: number;
  checksum: number;
  throughput: number;
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<CpuWorkRequest>) => void) | null;
  postMessage: (data: CpuWorkReply) => void;
};

scope.onmessage = (event: MessageEvent<CpuWorkRequest>) => {
  const { id, durationMs, seed } = event.data;
  scope.postMessage({ id, ...runCpuBurst(durationMs, seed) });
};
