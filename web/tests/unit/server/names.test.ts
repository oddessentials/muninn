import { describe, expect, it } from 'vitest';
import {
  bossKeyForPrefab,
  bossName,
  bossOrder,
  bossTier,
  canonicalBossKey,
  creatureName,
  isBossKey,
  isBossPrefab,
  keyCategory,
  raidLabel
} from '$lib/server/names';

describe('boss names and keys', () => {
  it('names a boss from its key, any phase prefab or either spelling of its name key', () => {
    expect(bossName('defeated_frozenking')).toBe('Kall Fimbulbringer');
    expect(bossName('defeated_writhan', 'Writhan', 'Writhan')).toBe('Writhan');
    expect(bossName('', 'FrozenKing_p2', null)).toBe('Kall Fimbulbringer');
    expect(bossName('', null, '$enemy_writhan')).toBe('Writhan');
    expect(bossName('defeated_hive', 'Hive', '$enemy_hive')).toBe('Hive');
    expect(bossName('defeated_hive', null, '$enemy_hive')).toBe('Hive');
    expect(bossName('defeated_unknown', null, null)).toBe('defeated_unknown');
  });

  it('keeps the Forsaken order and folds phase keys onto the final one', () => {
    expect(bossOrder('defeated_frozenking_p3')).toBe(8);
    expect(bossOrder('defeated_frozenking')).toBe(8);
    expect(bossOrder('defeated_writhan')).toBeNull();
    expect(canonicalBossKey('defeated_frozenking')).toBe('defeated_frozenking_p3');
    expect(canonicalBossKey('Defeated_Hive')).toBe('defeated_hive');
    expect(bossKeyForPrefab('FrozenKing_p2')).toBe('defeated_frozenking_p3');
    expect(bossKeyForPrefab('Hive')).toBe('defeated_hive');
  });

  it('sorts keys into tiers and categories', () => {
    expect(isBossKey('defeated_eikthyr')).toBe(true);
    expect(isBossKey('defeated_writhan')).toBe(false);
    expect(bossTier('bosshildir2')).toBe('mini');
    expect(bossTier('defeated_serpent')).toBe('mini');
    expect(bossTier('killedtroll')).toBe('other');
    expect(keyCategory('defeated_frozenking')).toBe('boss');
    expect(keyCategory('elakingmole_defeated')).toBe('mini_boss');
    expect(keyCategory('worldlevel')).toBe('modifier');
    expect(keyCategory('lastbossgate_open')).toBe('other');
    expect(isBossPrefab('FrozenKing_p2_ragdoll')).toBe(true);
    expect(isBossPrefab('Writhan')).toBe(false);
  });

  it('names the 1.0 creatures and labels the 1.0 raids', () => {
    expect(creatureName('FrozenKing_p3')).toBe('Kall Fimbulbringer');
    expect(creatureName('ElakingMole')).toBe('Eyeless One');
    expect(creatureName('JotunWitch')).toBe('Hexen');
    expect(creatureName('Bjorn_sleeping')).toBe('Bear');
    expect(creatureName('SomethingNew_x')).toBe('SomethingNew x');
    expect(raidLabel('army_jotuns')).toBe('The Jotun have found you');
    expect(raidLabel('army_elakingar')).toBe('They emerge from below...');
    expect(raidLabel('hildirboss3')).toBe('They were bros, man');
    expect(raidLabel('ghosts')).toBe('You feel a chill down your spine...');
  });
});
