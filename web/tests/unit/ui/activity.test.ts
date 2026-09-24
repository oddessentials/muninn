import { describe, expect, it } from 'vitest';
import type { ActivityItem } from '$lib/api/types';
import { activityMentions, describeActivity } from '$lib/ui/activity';
import { mergeActivity } from '$lib/ui/feed';

const bjorn = { id: 1, display_name: 'Bjorn', platform: 'Steam' as const };

function item(overrides: Partial<ActivityItem>): ActivityItem {
  return {
    id: 'a',
    at: '2026-09-10T19:00:00Z',
    day: 193,
    type: 'world.saved',
    player: null,
    summary: {},
    links: { raid_id: null, boss_key: null, run_id: null, session_id: null },
    ...overrides
  };
}

function text(view: ReturnType<typeof describeActivity>): string {
  return view.parts
    .map((part) => {
      switch (part.kind) {
        case 'player':
          return part.player ? part.player.display_name : 'someone';
        case 'players':
          return part.players.map((entry) => entry?.display_name ?? 'someone').join(', ');
        default:
          return part.text;
      }
    })
    .join('');
}

describe('activity descriptions', () => {
  it('names the player, the biome and the cause of a death', () => {
    const view = describeActivity(
      item({
        type: 'player.died',
        player: bjorn,
        summary: { biome: 'Mountain', x: 1, z: 2, cause: 'Greydwarf brute', attacker: null }
      })
    );
    expect(text(view)).toBe('Bjorn died in the Mountains, killed by Greydwarf brute');
    expect(view.tone).toBe('bad');
    expect(view.place).toEqual({ x: 1, z: 2, biome: 'Mountain' });
  });

  it('says when the cause was not observed and reads hit types as sentences', () => {
    expect(
      text(
        describeActivity(
          item({ type: 'player.died', player: bjorn, summary: { biome: 'Ocean', cause: null } })
        )
      )
    ).toBe('Bjorn died in the Ocean, cause not observed');
    expect(
      text(
        describeActivity(
          item({ type: 'player.died', player: bjorn, summary: { cause: 'Freezing' } })
        )
      )
    ).toBe('Bjorn died, froze');
  });

  it('renders hidden players as someone', () => {
    const view = describeActivity(
      item({ type: 'chat.message', player: null, summary: { kind: 'shout', text: 'hello' } })
    );
    expect(text(view)).toBe('someone shouted hello');
  });

  it('links bosses and raids through the item links', () => {
    const boss = describeActivity(
      item({
        type: 'boss.defeated',
        summary: { boss_name: 'Moder', first_time: true, participants: [bjorn], nearby: [] },
        links: { raid_id: null, boss_key: 'defeated_dragon', run_id: null, session_id: null }
      })
    );
    expect(boss.parts[0]).toEqual({ kind: 'link', text: 'Moder', href: '/bosses/defeated_dragon' });
    expect(text(boss)).toBe('Moder defeated for the first time, credited to Bjorn');
    const phase = describeActivity(
      item({
        type: 'boss.defeated',
        summary: {
          key: 'defeated_frozenking',
          boss_name: 'Kall Fimbulbringer',
          first_time: true,
          phase: 1,
          participants: [bjorn],
          nearby: []
        },
        links: { raid_id: null, boss_key: 'defeated_frozenking_p3', run_id: null, session_id: null }
      })
    );
    expect(text(phase)).toBe('Kall Fimbulbringer loses phase 1, credited to Bjorn');
    const next = describeActivity(
      item({
        type: 'boss.summoned',
        summary: {
          boss_name: 'Kall Fimbulbringer',
          phase: 2,
          method: 'zdo',
          prefab: 'FrozenKing_p2'
        },
        links: { raid_id: null, boss_key: 'defeated_frozenking_p3', run_id: null, session_id: null }
      })
    );
    expect(text(next)).toBe('Kall Fimbulbringer enters phase 2');
    const mini = describeActivity(
      item({
        type: 'global_key.set',
        summary: {
          key: 'defeated_writhan',
          first_time: true,
          boss_name: 'Writhan',
          nearby: [bjorn]
        },
        links: { raid_id: null, boss_key: 'defeated_writhan', run_id: null, session_id: null }
      })
    );
    expect(mini.parts[0]).toEqual({
      kind: 'link',
      text: 'Writhan',
      href: '/bosses/defeated_writhan'
    });
    expect(text(mini)).toBe('Writhan slain for the first time, nearby: Bjorn');
    const raid = describeActivity(
      item({
        type: 'raid.ended',
        summary: { raid_label: 'The forest is moving...', elapsed_s: 120 },
        links: { raid_id: 2, boss_key: null, run_id: null, session_id: null }
      })
    );
    expect(raid.parts[1]).toEqual({
      kind: 'link',
      text: 'The forest is moving...',
      href: '/raids/2'
    });
  });

  it('finds a player mentioned anywhere in the summary', () => {
    const engaged = item({ type: 'boss.engaged', summary: { nearby: [bjorn] } });
    expect(activityMentions(engaged, 1)).toBe(true);
    expect(activityMentions(engaged, 2)).toBe(false);
    expect(activityMentions(item({ player: bjorn }), 1)).toBe(true);
  });
});

describe('merging live items into a loaded feed', () => {
  it('drops duplicates, keeps newest first and applies the filter to live items only', () => {
    const loaded = [
      item({ id: 'b', at: '2026-09-10T18:00:00Z' }),
      item({ id: 'a', at: '2026-09-10T17:00:00Z' })
    ];
    const fresh = [
      item({ id: 'c', at: '2026-09-10T19:00:00Z', type: 'player.joined' }),
      item({ id: 'b', at: '2026-09-10T18:00:00Z' }),
      item({ id: 'd', at: '2026-09-10T16:00:00Z', type: 'server.heartbeat' })
    ];
    const merged = mergeActivity(fresh, loaded, 10, (entry) => entry.type !== 'server.heartbeat');
    expect(merged.map((entry) => entry.id)).toEqual(['c', 'b', 'a']);
    expect(mergeActivity(fresh, loaded, 2).map((entry) => entry.id)).toEqual(['c', 'b']);
  });
});
