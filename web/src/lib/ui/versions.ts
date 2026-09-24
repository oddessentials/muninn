import type { Status } from '$lib/api/types';

export function versionLine(
  site: string,
  status: Pick<Status, 'run' | 'game_version'> | null | undefined
): string {
  const parts = [`Site\u00a0${site}`];
  if (status?.run?.plugin_version) parts.push(`Plugin\u00a0${status.run.plugin_version}`);
  if (status?.game_version) parts.push(`Valheim\u00a0${status.game_version}`);
  return parts.join(' · ');
}
