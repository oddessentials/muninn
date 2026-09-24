import type { Raid } from '$lib/api/types';
import { formatDuration } from './format';

export type RaidStanding = 'running' | 'ended' | 'cut short';

type RaidTiming = Pick<Raid, 'duration_s' | 'end_reason' | 'active_s' | 'restored'>;

export function raidStanding(raid: Pick<Raid, 'duration_s' | 'end_reason'>): RaidStanding {
  if (raid.duration_s === null || raid.end_reason === null) return 'running';
  if (raid.end_reason === 'ended') return 'ended';
  return 'cut short';
}

export function raidLength(raid: RaidTiming): string {
  if (raidStanding(raid) !== 'ended') return '';
  return formatDuration(raid.active_s ?? raid.duration_s);
}

export function raidEndNote(raid: RaidTiming): string {
  if (raid.end_reason === 'server_stop') return 'the server stopped while it was pending';
  if (raid.end_reason === 'server_lost') return 'the server was lost while it was pending';
  return '';
}

export function raidPauseNote(raid: RaidTiming): string {
  if (raidStanding(raid) !== 'ended' || raid.active_s === null || raid.duration_s === null)
    return '';
  if (raid.duration_s - raid.active_s < 60) return '';
  return `${formatDuration(raid.duration_s)} passed on the clock; the raid timer pauses while nobody is in range`;
}

export function raidStartNote(raid: Pick<Raid, 'restored'>): string {
  return raid.restored ? 'already under way when the server started' : '';
}
