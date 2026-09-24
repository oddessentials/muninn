export const schemaVersion = 1 as const;
export const diagnosticVersion = '1.1.0' as const;
export const cpuKernelId = 'vzd-cpu-1.0.0' as const;

export interface Semver {
  major: number;
  minor: number;
  patch: number;
}

export function parseSemver(value: string): Semver | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function isCompatibleDiagnosticVersion(version: string): boolean {
  const parsed = parseSemver(version);
  const current = parseSemver(diagnosticVersion);
  if (!parsed || !current) return false;
  return parsed.major === current.major && parsed.minor === current.minor;
}
