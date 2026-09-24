import type { Boss, BossEvent } from '$lib/api/types';
import { forsakenCount, miniBosses } from '$lib/world/bosses';
import { formatNumber } from './format';

export const forsakenTotal = forsakenCount;
export const miniBossTotal = miniBosses.length;

export function bossTierEyebrow(boss: Pick<Boss, 'tier' | 'order'>): string {
  if (boss.tier === 'forsaken') return `Forsaken ${boss.order} of ${forsakenCount}`;
  if (boss.tier === 'mini') return 'Mini-boss';
  return 'Not one of the Forsaken';
}

export function bossEventLabel(event: Pick<BossEvent, 'kind' | 'phase'>): string {
  if (event.kind === 'phase') return `Phase ${event.phase ?? '?'} broken`;
  if (event.kind === 'summoned') {
    return event.phase !== null && event.phase > 1 ? `Phase ${event.phase} begins` : 'Summoned';
  }
  if (event.kind === 'engaged') {
    return event.phase !== null ? `Engaged in phase ${event.phase}` : 'Engaged';
  }
  return 'Defeated';
}

export type BossStanding = 'defeated' | 'fighting now' | 'undefeated';

export function bossStanding(boss: Pick<Boss, 'defeat' | 'active'>): BossStanding {
  if (boss.defeat) return 'defeated';
  if (boss.active) return 'fighting now';
  return 'undefeated';
}

export function bossDayNote(
  boss: Pick<Boss, 'defeat' | 'active' | 'kills' | 'summons' | 'engaged'>
): string {
  if (boss.defeat) {
    const day = `${boss.defeat.observed ? 'day' : 'by day'} ${formatNumber(boss.defeat.day)}`;
    return boss.kills > 1 ? `${day}, ${formatNumber(boss.kills)} kills` : day;
  }
  if (boss.active) return 'fighting now';
  if (boss.summons > 0 || boss.engaged > 0) return 'summoned, not defeated';
  return 'not yet';
}

export function bossDayTitle(boss: Pick<Boss, 'defeat'>): string | undefined {
  if (!boss.defeat || boss.defeat.observed) return undefined;
  return `Already defeated when the log began on day ${formatNumber(boss.defeat.day)}`;
}
