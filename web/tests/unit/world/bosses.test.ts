import { describe, expect, it } from 'vitest';
import {
  bossDefinitions,
  bossForKey,
  bossForNameKey,
  bossForPrefab,
  forsakenBosses,
  isFinalKey,
  miniBosses,
  phaseOfKey,
  phaseOfPrefab
} from '$lib/world/bosses';

describe('boss definitions', () => {
  it('lists eight Forsaken in the game order and six mini-bosses', () => {
    expect(forsakenBosses.map((boss) => boss.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(forsakenBosses[7]).toMatchObject({
      key: 'defeated_frozenking_p3',
      name: 'Kall Fimbulbringer'
    });
    expect(miniBosses.map((boss) => boss.name)).toEqual([
      'Serpent',
      'Brenna',
      'Writhan',
      'Geirrhafa',
      'Zil & Thungr',
      'Eyeless One'
    ]);
    expect(new Set(bossDefinitions.map((boss) => boss.key)).size).toBe(bossDefinitions.length);
  });

  it('resolves every key, phase prefab, alias and name key of a boss', () => {
    expect(bossForKey('DEFEATED_FROZENKING')?.name).toBe('Kall Fimbulbringer');
    expect(bossForKey('defeated_frozenking_p3')?.name).toBe('Kall Fimbulbringer');
    expect(bossForPrefab('FrozenKing_p2')?.key).toBe('defeated_frozenking_p3');
    expect(bossForPrefab('FrozenKing_p3_ragdoll')?.key).toBe('defeated_frozenking_p3');
    expect(bossForPrefab('Skeleton_Hildir_nochest')?.name).toBe('Brenna');
    expect(bossForNameKey('$enemy_writhan')?.key).toBe('defeated_writhan');
    expect(bossForNameKey('Writhan')?.key).toBe('defeated_writhan');
    expect(bossForKey('killedtroll')).toBeNull();
    expect(bossForPrefab('Troll')).toBeNull();
  });

  it('numbers the phases of Kall and none for a single-phase boss', () => {
    expect(phaseOfPrefab('FrozenKing')).toBe(1);
    expect(phaseOfPrefab('FrozenKing_p2')).toBe(2);
    expect(phaseOfPrefab('FrozenKing_p3')).toBe(3);
    expect(phaseOfPrefab('Eikthyr')).toBeNull();
    expect(phaseOfKey('defeated_frozenking')).toBe(1);
    expect(phaseOfKey('defeated_frozenking_p3')).toBe(3);
    expect(phaseOfKey('defeated_eikthyr')).toBeNull();
    expect(isFinalKey('defeated_frozenking')).toBe(false);
    expect(isFinalKey('defeated_frozenking_p3')).toBe(true);
    expect(isFinalKey('defeated_writhan')).toBe(true);
    expect(isFinalKey('defeated_hive')).toBe(false);
  });
});
