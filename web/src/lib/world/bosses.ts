export type BossTier = 'forsaken' | 'mini' | 'other';

export interface BossPhase {
  prefab: string;
  key: string | null;
}

export interface BossDefinition {
  key: string;
  name: string;
  tier: 'forsaken' | 'mini';
  order: number;
  prefab: string;
  nameKeys: readonly string[];
  phases: readonly BossPhase[];
  aliases: readonly string[];
}

const forsaken = (
  order: number,
  key: string,
  name: string,
  prefab: string,
  nameKeys: readonly string[],
  phases: readonly BossPhase[] = []
): BossDefinition => ({
  key,
  name,
  tier: 'forsaken',
  order,
  prefab,
  nameKeys,
  phases,
  aliases: []
});

const mini = (
  order: number,
  key: string,
  name: string,
  prefab: string,
  nameKeys: readonly string[],
  aliases: readonly string[] = []
): BossDefinition => ({ key, name, tier: 'mini', order, prefab, nameKeys, phases: [], aliases });

export const bossDefinitions: readonly BossDefinition[] = [
  forsaken(1, 'defeated_eikthyr', 'Eikthyr', 'Eikthyr', ['$enemy_eikthyr']),
  forsaken(2, 'defeated_gdking', 'The Elder', 'gd_king', ['$enemy_gdking']),
  forsaken(3, 'defeated_bonemass', 'Bonemass', 'Bonemass', ['$enemy_bonemass']),
  forsaken(4, 'defeated_dragon', 'Moder', 'Dragon', ['$enemy_dragon']),
  forsaken(5, 'defeated_goblinking', 'Yagluth', 'GoblinKing', ['$enemy_goblinking']),
  forsaken(6, 'defeated_queen', 'The Queen', 'SeekerQueen', ['$enemy_seekerqueen']),
  forsaken(7, 'defeated_fader', 'Fader', 'Fader', ['$enemy_fader']),
  forsaken(
    8,
    'defeated_frozenking_p3',
    'Kall Fimbulbringer',
    'FrozenKing',
    ['$enemy_frozenking', '$enemy_frozenking_p3'],
    [
      { prefab: 'FrozenKing', key: 'defeated_frozenking' },
      { prefab: 'FrozenKing_p2', key: null },
      { prefab: 'FrozenKing_p3', key: 'defeated_frozenking_p3' }
    ]
  ),
  mini(1, 'defeated_serpent', 'Serpent', 'Serpent', ['$enemy_serpent']),
  mini(
    2,
    'bosshildir1',
    'Brenna',
    'Skeleton_Hildir',
    ['$enemy_skeletonfire'],
    ['Skeleton_Hildir_nochest']
  ),
  mini(3, 'defeated_writhan', 'Writhan', 'Writhan', ['$enemy_writhan', 'Writhan']),
  mini(
    4,
    'bosshildir2',
    'Geirrhafa',
    'Fenring_Cultist_Hildir',
    ['$enemy_fenringcultist_hildir'],
    ['Fenring_Cultist_Hildir_nochest']
  ),
  mini(
    5,
    'bosshildir3',
    'Zil & Thungr',
    'GoblinBruteBros',
    ['$enemy_goblinbrute_hildircombined'],
    ['GoblinBruteBros_nochest']
  ),
  mini(6, 'elakingmole_defeated', 'Eyeless One', 'ElakingMole', ['$enemy_elakingmole'])
];

export const forsakenBosses = bossDefinitions.filter((boss) => boss.tier === 'forsaken');
export const miniBosses = bossDefinitions.filter((boss) => boss.tier === 'mini');
export const forsakenCount = forsakenBosses.length;

const byKey = new Map<string, BossDefinition>();
const byPrefab = new Map<string, BossDefinition>();
const byNameKey = new Map<string, BossDefinition>();
for (const boss of bossDefinitions) {
  byKey.set(boss.key.toLowerCase(), boss);
  for (const phase of boss.phases) if (phase.key) byKey.set(phase.key.toLowerCase(), boss);
  byPrefab.set(boss.prefab.toLowerCase(), boss);
  for (const phase of boss.phases) byPrefab.set(phase.prefab.toLowerCase(), boss);
  for (const alias of boss.aliases) byPrefab.set(alias.toLowerCase(), boss);
  for (const nameKey of boss.nameKeys) byNameKey.set(nameKey.toLowerCase(), boss);
}

function basePrefab(prefab: string): string {
  return prefab.replace(/_ragdoll$/i, '').toLowerCase();
}

export function bossForKey(key: string): BossDefinition | null {
  return byKey.get(key.toLowerCase()) ?? null;
}

export function bossForPrefab(prefab: string): BossDefinition | null {
  return byPrefab.get(basePrefab(prefab)) ?? null;
}

export function bossForNameKey(nameKey: string): BossDefinition | null {
  return byNameKey.get(nameKey.toLowerCase()) ?? null;
}

export function phaseOfPrefab(prefab: string): number | null {
  const boss = bossForPrefab(prefab);
  if (!boss || boss.phases.length === 0) return null;
  const index = boss.phases.findIndex((phase) => phase.prefab.toLowerCase() === basePrefab(prefab));
  return index < 0 ? null : index + 1;
}

export function phaseOfKey(key: string): number | null {
  const boss = bossForKey(key);
  if (!boss || boss.phases.length === 0) return null;
  const index = boss.phases.findIndex((phase) => phase.key?.toLowerCase() === key.toLowerCase());
  return index < 0 ? null : index + 1;
}

export function isFinalKey(key: string): boolean {
  const boss = bossForKey(key);
  return boss !== null && boss.key === key.toLowerCase();
}
