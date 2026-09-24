import type { ActivityItem, PlayerRef } from '$lib/api/types';
import { formatDuration, formatMillis, formatNumber, formatPosition, formatUtc } from './format';
import { biomeLabel, hitTypeLabel, isHitType, leftReasonLabel, prefabLabel } from './labels';

export type ActivityTone = 'neutral' | 'good' | 'bad' | 'warn' | 'info';

export type ActivityPart =
  | { kind: 'text'; text: string }
  | { kind: 'player'; player: PlayerRef | null }
  | { kind: 'players'; players: (PlayerRef | null)[]; empty: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'code'; text: string }
  | { kind: 'quote'; text: string };

export interface ActivityView {
  tone: ActivityTone;
  parts: ActivityPart[];
  place: { x: number; z: number; biome: string | null } | null;
}

type Summary = Record<string, unknown>;

function str(summary: Summary, key: string): string | null {
  const value = summary[key];
  return typeof value === 'string' && value !== '' ? value : null;
}

function num(summary: Summary, key: string): number | null {
  const value = summary[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function bool(summary: Summary, key: string): boolean {
  return summary[key] === true;
}

function isRef(value: unknown): value is PlayerRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PlayerRef).id === 'number' &&
    typeof (value as PlayerRef).display_name === 'string'
  );
}

function ref(summary: Summary, key: string): PlayerRef | null {
  const value = summary[key];
  return isRef(value) ? value : null;
}

function refs(summary: Summary, key: string): (PlayerRef | null)[] {
  const value = summary[key];
  if (!Array.isArray(value)) return [];
  return value.map((entry) => (isRef(entry) ? entry : null));
}

function strings(summary: Summary, key: string): string[] {
  const value = summary[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

const text = (value: string): ActivityPart => ({ kind: 'text', text: value });
const player = (value: PlayerRef | null): ActivityPart => ({ kind: 'player', player: value });
const players = (value: (PlayerRef | null)[], empty: string): ActivityPart => ({
  kind: 'players',
  players: value,
  empty
});
const link = (label: string, href: string): ActivityPart => ({ kind: 'link', text: label, href });
const code = (value: string): ActivityPart => ({ kind: 'code', text: value });
const quote = (value: string): ActivityPart => ({ kind: 'quote', text: value });

function place(summary: Summary): ActivityView['place'] {
  const x = num(summary, 'x');
  const z = num(summary, 'z');
  if (x === null || z === null) return null;
  return { x, z, biome: str(summary, 'biome') };
}

function inBiome(summary: Summary): string {
  const biome = str(summary, 'biome');
  return biome ? ` in the ${biomeLabel(biome)}` : '';
}

export function bossHref(key: string | null): string | null {
  return key ? `/bosses/${encodeURIComponent(key)}` : null;
}

export function raidHref(id: number | null): string | null {
  return id === null ? null : `/raids/${id}`;
}

function bossLink(name: string, key: string | null): ActivityPart {
  const href = bossHref(key);
  return href ? link(name, href) : text(name);
}

function raidLink(label: string, id: number | null): ActivityPart {
  const href = raidHref(id);
  return href ? link(label, href) : text(label);
}

function mentions(value: unknown, playerId: number, depth = 0): boolean {
  if (depth > 3 || value === null || typeof value !== 'object') return false;
  if (isRef(value)) return value.id === playerId;
  if (Array.isArray(value)) return value.some((entry) => mentions(entry, playerId, depth + 1));
  return Object.values(value as Summary).some((entry) => mentions(entry, playerId, depth + 1));
}

export function activityMentions(item: ActivityItem, playerId: number): boolean {
  return item.player?.id === playerId || mentions(item.summary, playerId);
}

export function describeActivity(item: ActivityItem): ActivityView {
  const s = item.summary as Summary;
  const who = item.player;
  switch (item.type) {
    case 'server.started': {
      const network = num(s, 'network_version');
      const keys = strings(s, 'global_keys');
      const parts = [
        text('Server started'),
        text(
          ` with game ${str(s, 'game_version') ?? '?'}${network === null ? '' : ` (network ${network})`}, plugin ${str(s, 'plugin_version') ?? '?'}, BepInEx ${str(s, 'bepinex_version') ?? '?'}, Unity ${str(s, 'unity_version') ?? '?'} on world ${str(s, 'world_name') ?? '?'} (day ${formatNumber(num(s, 'world_day') ?? item.day)}, ${keys.length} global keys set)`
        )
      ];
      const missing = strings(s, 'missing_hooks');
      if (missing.length > 0) parts.push(text(`, missing hooks: ${missing.join(', ')}`));
      return { tone: 'info', parts, place: null };
    }
    case 'server.stopping':
      return {
        tone: 'warn',
        parts: [
          text(
            `Server stopping after ${formatDuration(num(s, 'uptime_s'))} with ${formatNumber(num(s, 'online_count') ?? 0)} online`
          )
        ],
        place: null
      };
    case 'server.heartbeat': {
      const online = Array.isArray(s.players) ? s.players.length : 0;
      const lastSave = num(s, 'last_save_age_s');
      return {
        tone: 'neutral',
        parts: [
          text(
            `Heartbeat: up ${formatDuration(num(s, 'uptime_s'))}, ${online} online, queue ${formatNumber(num(s, 'queue_depth') ?? 0)}, dropped ${formatNumber(num(s, 'dropped_events') ?? 0)}${lastSave === null ? '' : `, last save ${formatDuration(lastSave)} ago`}`
          )
        ],
        place: null
      };
    }
    case 'server.lost':
      return {
        tone: 'bad',
        parts: [
          text(
            `Server lost: no heartbeat for 180 s${str(s, 'last_heartbeat_at') ? `, the last one arrived ${formatUtc(str(s, 'last_heartbeat_at'))}` : ''}`
          )
        ],
        place: null
      };
    case 'world.save_started':
      return { tone: 'neutral', parts: [text('World save started')], place: null };
    case 'world.saved':
      return {
        tone: 'neutral',
        parts: [text(`World saved in ${formatMillis(num(s, 'duration_ms'))}`)],
        place: null
      };
    case 'world.rollback_detected': {
      const from = num(s, 'from_net_time');
      const to = num(s, 'to_net_time');
      const back = from !== null && to !== null ? formatDuration(from - to) : '';
      return {
        tone: 'bad',
        parts: [text(`World rolled back${back ? ` by ${back}` : ''} on restart`)],
        place: null
      };
    }
    case 'world.dusk_approaching': {
      const lead = num(s, 'dusk_in_s');
      return {
        tone: 'warn',
        parts: [
          text(
            `The bell tolls for dusk${lead === null ? '' : `, nightfall in ${formatDuration(lead)}`}`
          )
        ],
        place: null
      };
    }
    case 'world.dawn_approaching': {
      const lead = num(s, 'dawn_in_s');
      return {
        tone: 'good',
        parts: [
          text(
            `The rooster crows for dawn${lead === null ? '' : `, sunrise in ${formatDuration(lead)}`}`
          )
        ],
        place: null
      };
    }
    case 'player.joined':
      return {
        tone: 'good',
        parts: [
          player(who),
          text(
            ` joined as ${str(s, 'name') ?? 'an unnamed character'}${str(s, 'platform') ? ` on ${str(s, 'platform')}` : ''}`
          )
        ],
        place: null
      };
    case 'player.spawned':
      return {
        tone: 'neutral',
        parts: [
          player(who),
          text(`${bool(s, 'respawn') ? ' respawned' : ' spawned'}${inBiome(s)}`)
        ],
        place: place(s)
      };
    case 'player.died': {
      const cause = str(s, 'cause');
      const attacker = ref(s, 'attacker');
      const parts: ActivityPart[] = [player(who), text(` died${inBiome(s)}`)];
      if (attacker) parts.push(text(', killed by '), player(attacker));
      else if (cause && isHitType(cause))
        parts.push(text(`, ${hitTypeLabel(cause).toLowerCase()}`));
      else if (cause) parts.push(text(`, killed by ${cause}`));
      else parts.push(text(', cause not observed'));
      return { tone: 'bad', parts, place: place(s) };
    }
    case 'player.left':
      return {
        tone: 'neutral',
        parts: [
          player(who),
          text(
            ` left after ${formatDuration(num(s, 'session_s'))}${str(s, 'reason') ? ` (${leftReasonLabel(str(s, 'reason'))})` : ''}`
          )
        ],
        place: null
      };
    case 'player.biome_changed':
      return {
        tone: bool(s, 'first_discovery') ? 'good' : 'neutral',
        parts: [
          player(who),
          text(
            `${bool(s, 'first_discovery') ? ' discovered' : ' entered'} the ${biomeLabel(str(s, 'to'))} from the ${biomeLabel(str(s, 'from'))}`
          )
        ],
        place: place(s)
      };
    case 'player.position':
      return {
        tone: 'neutral',
        parts: [player(who), text(` at ${formatPosition(num(s, 'x'), num(s, 'z'))}${inBiome(s)}`)],
        place: place(s)
      };
    case 'boss.summoned': {
      const name = str(s, 'boss_name') ?? str(s, 'prefab') ?? 'A boss';
      const phase = num(s, 'phase');
      if (phase !== null && phase > 1) {
        return {
          tone: 'warn',
          parts: [bossLink(name, item.links.boss_key), text(` enters phase ${phase}${inBiome(s)}`)],
          place: place(s)
        };
      }
      const summoner = ref(s, 'summoner') ?? who;
      const parts: ActivityPart[] = [bossLink(name, item.links.boss_key)];
      if (summoner) parts.push(text(' summoned by '), player(summoner));
      else parts.push(text(' summoned'));
      parts.push(
        text(
          `${inBiome(s)}${str(s, 'method') === 'zdo' ? ' (seen appearing, summoner unknown)' : ''}`
        )
      );
      return { tone: 'warn', parts, place: place(s) };
    }
    case 'boss.engaged': {
      const name = str(s, 'boss_name') ?? str(s, 'prefab') ?? 'A boss';
      const phase = num(s, 'phase');
      return {
        tone: 'warn',
        parts: [
          bossLink(name, item.links.boss_key),
          text(` engaged${phase !== null ? ` in phase ${phase}` : ''}${inBiome(s)}, nearby: `),
          players(refs(s, 'nearby'), 'nobody')
        ],
        place: place(s)
      };
    }
    case 'boss.defeated': {
      const name = str(s, 'boss_name') ?? str(s, 'key') ?? 'A boss';
      const participants = refs(s, 'participants');
      const nearby = refs(s, 'nearby');
      const phase = num(s, 'phase');
      const finalPhase = phase === null || str(s, 'key') === item.links.boss_key;
      const parts: ActivityPart[] = [
        bossLink(name, item.links.boss_key),
        text(
          finalPhase
            ? bool(s, 'first_time')
              ? ' defeated for the first time'
              : ' defeated again'
            : ` loses phase ${phase}`
        )
      ];
      if (participants.length > 0)
        parts.push(text(', credited to '), players(participants, 'nobody'));
      if (nearby.length > 0) parts.push(text(', nearby: '), players(nearby, 'nobody'));
      const sender = ref(s, 'sender');
      if (sender && !participants.some((entry) => entry?.id === sender.id))
        parts.push(text(', reported by '), player(sender));
      return { tone: 'good', parts, place: null };
    }
    case 'global_key.set': {
      const bossName = str(s, 'boss_name');
      if (bossName) {
        const nearby = refs(s, 'nearby');
        const parts: ActivityPart[] = [
          bossLink(bossName, item.links.boss_key),
          text(bool(s, 'first_time') ? ' slain for the first time' : ' slain again')
        ];
        if (nearby.length > 0) parts.push(text(', nearby: '), players(nearby, 'nobody'));
        return { tone: 'good', parts, place: null };
      }
      const value = str(s, 'value');
      return {
        tone: 'info',
        parts: [
          text('Global key '),
          code(`${str(s, 'key') ?? '?'}${value ? ` ${value}` : ''}`),
          text(bool(s, 'first_time') ? ' set for the first time' : ' set')
        ],
        place: null
      };
    }
    case 'raid.started': {
      const label = str(s, 'raid_label') ?? str(s, 'name') ?? 'A raid';
      return {
        tone: 'warn',
        parts: [
          text('Raid '),
          raidLink(label, item.links.raid_id),
          text(` started${inBiome(s)} for ${formatDuration(num(s, 'duration_s'))}, nearby: `),
          players(refs(s, 'nearby'), 'nobody')
        ],
        place: place(s)
      };
    }
    case 'raid.ended': {
      const label = str(s, 'raid_label') ?? str(s, 'name') ?? 'A raid';
      return {
        tone: 'neutral',
        parts: [
          text('Raid '),
          raidLink(label, item.links.raid_id),
          text(` ended after ${formatDuration(num(s, 'active_s') ?? num(s, 'elapsed_s'))}`)
        ],
        place: null
      };
    }
    case 'structure.built':
      return {
        tone: 'neutral',
        parts: [
          player(ref(s, 'creator') ?? who),
          text(' built '),
          code(prefabLabel(str(s, 'prefab')) || '?'),
          text(inBiome(s))
        ],
        place: place(s)
      };
    case 'structure.destroyed':
      return {
        tone: 'neutral',
        parts: [code(prefabLabel(str(s, 'prefab')) || '?'), text(` destroyed${inBiome(s)}`)],
        place: place(s)
      };
    case 'creature.died': {
      const creature = str(s, 'creature') ?? prefabLabel(str(s, 'prefab')) ?? 'A creature';
      const level = num(s, 'level');
      const credited = refs(s, 'credited');
      const nearby = refs(s, 'nearby');
      const parts: ActivityPart[] = [
        text(
          `${creature}${level !== null && level > 1 ? ` (level ${level})` : ''} killed${inBiome(s)}`
        )
      ];
      if (credited.length > 0) parts.push(text(' by '), players(credited, 'nobody'));
      else if (nearby.length > 0) parts.push(text(' near '), players(nearby, 'nobody'));
      return { tone: 'neutral', parts, place: place(s) };
    }
    case 'chat.message': {
      const kind = str(s, 'kind');
      const body = str(s, 'text');
      if (kind === 'ping')
        return {
          tone: 'info',
          parts: [
            player(who),
            text(` pinged ${formatPosition(num(s, 'x'), num(s, 'z'))}${inBiome(s)}`)
          ],
          place: place(s)
        };
      return {
        tone: 'info',
        parts: [player(who), text(kind === 'shout' ? ' shouted ' : ' said '), quote(body ?? '')],
        place: place(s)
      };
    }
    case 'announcement.shown': {
      const remaining = num(s, 'remaining_s');
      const detail =
        str(s, 'kind') === 'restart'
          ? bool(s, 'final')
            ? ' (restart countdown finished)'
            : remaining === null
              ? ' (restart countdown)'
              : ` (restart in ${formatDuration(remaining)})`
          : '';
      return {
        tone: 'info',
        parts: [text('Announced in game '), quote(str(s, 'text') ?? ''), text(detail)],
        place: null
      };
    }
    default:
      return { tone: 'neutral', parts: [text(String(item.type))], place: place(s) };
  }
}
