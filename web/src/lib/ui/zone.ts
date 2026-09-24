import type { ZoneRating, ZoneRecommendation } from '$lib/api/types';
import type { DiagnosticPhase } from '$lib/zone/run-all';

export const ratingLabels: Record<ZoneRating, string> = {
  excellent: 'Excellent',
  strong: 'Strong',
  acceptable: 'Acceptable',
  weak: 'Weak',
  poor: 'Poor'
};

export const ratingTones: Record<ZoneRating, string> = {
  excellent: 'text-accent-bright',
  strong: 'text-accent',
  acceptable: 'text-ink',
  weak: 'text-warning',
  poor: 'text-danger'
};

export const ratingColors: Record<ZoneRating, string> = {
  excellent: 'var(--color-accent-bright)',
  strong: 'var(--color-accent)',
  acceptable: 'var(--color-ink)',
  weak: 'var(--color-warning)',
  poor: 'var(--color-danger)'
};

export const recommendationLabels: Record<ZoneRecommendation, string> = {
  primary: 'Primary',
  backup: 'Backup',
  avoid: 'Avoid'
};

export const recommendationTones: Record<ZoneRecommendation, string> = {
  primary: 'text-online',
  backup: 'text-warning',
  avoid: 'text-danger'
};

export const recommendationNotes: Record<ZoneRecommendation, string> = {
  primary: 'hand this player the zone',
  backup: 'a fallback when no primary is on',
  avoid: 'keep the zone away from this rig'
};

export interface PhaseStep {
  id: DiagnosticPhase;
  label: string;
}

export const phaseSteps: readonly PhaseStep[] = [
  { id: 'cpu', label: 'CPU' },
  { id: 'stability', label: 'Frames' },
  { id: 'network', label: 'Network' },
  { id: 'score', label: 'Score' }
];

export function phaseIndex(phase: DiagnosticPhase): number {
  return phaseSteps.findIndex((step) => step.id === phase);
}

export function formatMs(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)} ms`;
}

export function formatMbps(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} Mbps`;
}

export function formatThroughput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('en-US')}/ms`;
}

export function formatCount(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return '—';
  return `${value} ${unit}`;
}

export function ordinal(rank: number): string {
  const rest = rank % 100;
  if (rest >= 11 && rest <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}
