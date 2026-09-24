export type ScoreTable = ReadonlyArray<readonly [number, number]>;

export const scoreWeights = {
  network: 0.45,
  cpu: 0.35,
  stability: 0.15,
  secondary: 0.05
} as const;

export const networkWeights = {
  stability: 0.28,
  latency: 0.24,
  jitter: 0.18,
  p95: 0.14,
  upload: 0.1,
  download: 0.06
} as const;

export const cpuWeights = {
  singleThread: 0.75,
  multiThread: 0.15,
  cores: 0.1
} as const;

export const stabilityWeights = {
  frameTime: 0.45,
  stalls: 0.25,
  cpuVariance: 0.3
} as const;

export const secondaryWeights = {
  memory: 0.4,
  gpuAdequacy: 0.35,
  gpuInfo: 0.15,
  completeness: 0.1
} as const;

export const networkTables = {
  latencyMs: [
    [8, 100],
    [15, 98],
    [18, 96],
    [25, 90],
    [35, 80],
    [50, 65],
    [80, 40],
    [120, 22],
    [180, 8],
    [250, 0]
  ],
  jitterMs: [
    [1, 100],
    [2, 98],
    [3, 94],
    [5, 86],
    [8, 74],
    [12, 58],
    [20, 32],
    [30, 16],
    [45, 4],
    [60, 0]
  ],
  p95Ms: [
    [12, 100],
    [20, 97],
    [27, 92],
    [40, 80],
    [60, 62],
    [90, 40],
    [130, 22],
    [200, 8],
    [280, 0]
  ],
  failureRate: [
    [0, 100],
    [0.02, 82],
    [0.05, 55],
    [0.08, 32],
    [0.12, 16],
    [0.2, 4],
    [0.35, 0]
  ],
  uploadMbps: [
    [0, 0],
    [3, 38],
    [5, 55],
    [8, 68],
    [12, 80],
    [18, 90],
    [25, 95],
    [40, 98],
    [80, 100]
  ],
  downloadMbps: [
    [0, 0],
    [5, 45],
    [10, 68],
    [18, 82],
    [30, 90],
    [50, 96],
    [100, 100]
  ]
} as const satisfies Record<string, ScoreTable>;

export const cpuTables = {
  singleThreadPerMs: [
    [26000, 8],
    [54000, 22],
    [86000, 38],
    [140000, 55],
    [195000, 68],
    [260000, 78],
    [325000, 85],
    [390000, 90],
    [475000, 95],
    [600000, 100]
  ],
  multiThreadPerMs: [
    [86000, 12],
    [173000, 28],
    [346000, 48],
    [690000, 68],
    [1080000, 80],
    [1620000, 90],
    [2160000, 96],
    [3020000, 100]
  ],
  logicalProcessors: [
    [1, 28],
    [2, 48],
    [4, 70],
    [6, 82],
    [8, 90],
    [12, 96],
    [16, 100]
  ]
} as const satisfies Record<string, ScoreTable>;

export const stabilityTables = {
  frameTimeP95Ms: [
    [7, 100],
    [9, 97],
    [12, 92],
    [16.7, 86],
    [20, 78],
    [25, 64],
    [33, 48],
    [50, 24],
    [80, 8],
    [120, 0]
  ],
  stallCount: [
    [0, 100],
    [1, 82],
    [2, 68],
    [4, 48],
    [8, 24],
    [14, 8],
    [20, 0]
  ],
  cpuVariance: [
    [0.01, 100],
    [0.03, 94],
    [0.06, 82],
    [0.1, 68],
    [0.16, 48],
    [0.25, 26],
    [0.4, 8],
    [0.6, 0]
  ]
} as const satisfies Record<string, ScoreTable>;

export const secondaryTables = {
  deviceMemoryGB: [
    [2, 28],
    [4, 55],
    [6, 70],
    [8, 82],
    [12, 92],
    [16, 98],
    [24, 100]
  ],
  gpuFrameMs: [
    [4, 100],
    [8, 96],
    [12, 88],
    [16, 78],
    [24, 58],
    [33, 38],
    [50, 18],
    [80, 0]
  ]
} as const satisfies Record<string, ScoreTable>;

export const ratingThresholds = {
  excellent: 90,
  strong: 75,
  acceptable: 60,
  weak: 40
} as const;

export const recommendationThresholds = {
  primaryOverall: 80,
  primaryNetwork: 72,
  backupOverall: 60,
  backupNetwork: 50,
  avoidOverall: 55,
  avoidNetwork: 50
} as const;

export const hardPenaltyRules = [
  {
    id: 'net-fail-severe',
    amount: 25,
    avoid: true,
    message: 'Repeated network failures make zone ownership unreliable.'
  },
  {
    id: 'net-fail-high',
    amount: 15,
    avoid: true,
    message: 'Connection failures were frequent enough to risk dropping zone state.'
  },
  {
    id: 'net-fail-moderate',
    amount: 8,
    avoid: false,
    message: 'Some request failures were observed during the network test.'
  },
  {
    id: 'jitter-extreme',
    amount: 20,
    avoid: true,
    message: 'Severe jitter would desynchronize players in a hosted zone.'
  },
  {
    id: 'jitter-high',
    amount: 12,
    avoid: true,
    message: 'High jitter is poorly suited to area ownership.'
  },
  {
    id: 'latency-extreme',
    amount: 25,
    avoid: true,
    message: 'Extreme latency makes this connection a poor zone-leader candidate.'
  },
  {
    id: 'latency-high',
    amount: 15,
    avoid: true,
    message: 'High round-trip latency would be felt by everyone in the zone.'
  },
  {
    id: 'cpu-failed',
    amount: 20,
    avoid: true,
    message: 'The CPU diagnostic could not be completed.'
  },
  {
    id: 'network-failed',
    amount: 25,
    avoid: true,
    message: 'The network diagnostic could not be completed.'
  },
  {
    id: 'unstable-bench',
    amount: 15,
    avoid: false,
    message: 'Benchmark results were unusually inconsistent.'
  }
] as const;

export type HardPenaltyId = (typeof hardPenaltyRules)[number]['id'];

export const hardPenaltyTriggers = {
  netFailSevere: 0.15,
  netFailHigh: 0.08,
  netFailModerate: 0.03,
  jitterExtremeMs: 40,
  jitterHighMs: 25,
  latencyExtremeMs: 200,
  latencyHighMs: 150,
  unstableVariance: 0.25,
  unstableFrameP95Ms: 80,
  unstableFrameVariance: 0.15
} as const;

export const benchmark = {
  cpuWarmupMs: 280,
  cpuSampleMs: 380,
  cpuSingleSamples: 5,
  cpuMultiSamples: 3,
  cpuMaxWorkers: 8,
  cpuBatchIterations: 2048,
  frameSampleCount: 150,
  frameSampleLimitMs: 15_000,
  stallFrameMs: 50,
  gpuFrames: 90,
  pingCount: 12,
  pingTimeoutMs: 2500,
  throughputTimeoutMs: 8000,
  downloadBytes: 512 * 1024,
  uploadBytes: 256 * 1024,
  downloadBytesLarge: 1024 * 1024,
  uploadBytesLarge: 512 * 1024
} as const;
