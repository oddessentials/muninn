import type { Biome } from '$lib/api/types';
import {
  bossDefinitions,
  bossForKey,
  bossForNameKey,
  bossForPrefab,
  type BossDefinition,
  type BossTier
} from '$lib/world/bosses';

export {
  bossDefinitions,
  forsakenBosses,
  miniBosses,
  type BossDefinition
} from '$lib/world/bosses';

export const knownBosses: readonly BossDefinition[] = bossDefinitions;

export function bossDefinitionOf(
  key: string,
  prefab?: string | null,
  nameKey?: string | null
): BossDefinition | null {
  return (
    bossForKey(key) ??
    (prefab ? bossForPrefab(prefab) : null) ??
    (nameKey ? bossForNameKey(nameKey) : null)
  );
}

export function isBossKey(key: string): boolean {
  return bossForKey(key)?.tier === 'forsaken';
}

export function isMiniBossKey(key: string): boolean {
  return bossForKey(key)?.tier === 'mini';
}

export function canonicalBossKey(key: string): string {
  return bossForKey(key)?.key ?? key.toLowerCase();
}

export function bossTier(key: string): BossTier {
  return bossForKey(key)?.tier ?? 'other';
}

function nameFromNameKey(nameKey: string): string | null {
  const match = /^\$enemy_(.+)$/i.exec(nameKey);
  if (!match) return nameKey.startsWith('$') ? null : nameKey;
  const word = match[1]!.replace(/_/g, ' ');
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function bossName(key: string, prefab?: string | null, nameKey?: string | null): string {
  const known = bossDefinitionOf(key, prefab, nameKey);
  if (known) return known.name;
  if (prefab) return creatureName(prefab);
  if (nameKey) {
    const fromKey = nameFromNameKey(nameKey);
    if (fromKey) return fromKey;
  }
  return key;
}

export function bossOrder(key: string): number | null {
  const known = bossForKey(key);
  return known?.tier === 'forsaken' ? known.order : null;
}

export function bossKeyForPrefab(prefab: string): string {
  const known = bossForPrefab(prefab);
  if (known) return known.key;
  return `defeated_${prefab.toLowerCase()}`;
}

export function bossPrefabForKey(key: string): string | null {
  return bossForKey(key)?.prefab ?? null;
}

export const raidLabels: Readonly<Record<string, string>> = {
  army_eikthyr: 'Eikthyr rallies the creatures of the forest',
  army_theelder: 'The forest is moving...',
  army_bonemass: 'A foul smell from the swamp...',
  army_moder: 'A cold wind blows from the mountains',
  army_goblin: 'The horde is attacking!',
  army_gjall: "What's up, Gjall?!",
  army_seekers: 'They sought you out',
  army_charred: 'The undead army marches',
  army_charredspawners: 'The dead have been summoned',
  army_elakingar: 'They emerge from below...',
  army_jotuns: 'The Jotun have found you',
  foresttrolls: 'The ground is shaking',
  blobs: 'A foul smell from the swamp...',
  skeletons: 'A skeleton surprise!',
  surtlings: "There's a smell of sulfur in the air...",
  wolves: 'You are being hunted...',
  bats: 'You stirred the cauldron',
  ghosts: 'You feel a chill down your spine...',
  gemgoblin: "Get 'em!",
  hildirboss1: "She's hot on your tail!",
  hildirboss2: 'You get the chills...',
  hildirboss3: 'They were bros, man',
  boss_eikthyr: 'Eikthyr is angry',
  boss_gdking: 'The Elder stirs',
  boss_bonemass: 'Bonemass is approaching',
  boss_moder: 'Moder circles overhead',
  boss_goblinking: 'Yagluth is coming',
  boss_queen: 'The Queen is hunting',
  boss_fader: 'Fader awakens',
  boss_frozenking: 'Kall Fimbulbringer stirs',
  fimbulvinter: 'Fimbulwinter'
};

export function raidLabel(name: string): string {
  return raidLabels[name] ?? raidLabels[name.toLowerCase()] ?? name;
}

export const biomes: readonly Biome[] = [
  'Meadows',
  'BlackForest',
  'Swamp',
  'Mountain',
  'Plains',
  'Mistlands',
  'AshLands',
  'DeepNorth',
  'Ocean',
  'None'
];

const biomeLookup = new Map(biomes.map((biome) => [biome.toLowerCase(), biome]));

export function biomeName(value: string | null | undefined): Biome {
  if (!value) return 'None';
  return biomeLookup.get(value.toLowerCase()) ?? 'None';
}

const modifierKeys = new Set(
  [
    'PlayerDamage',
    'EnemyDamage',
    'WorldLevel',
    'EventRate',
    'ResourceRate',
    'StaminaRate',
    'AdrenalineRate',
    'EitrRate',
    'DurabilityRate',
    'FoodRate',
    'MoveStaminaRate',
    'StaminaRegenRate',
    'SkillGainRate',
    'SkillReductionRate',
    'EnemySpeedSize',
    'EnemyLevelUpRate',
    'CarryWeightRate',
    'PlayerEvents',
    'Fire',
    'DeathKeepEquip',
    'DeathDeleteItems',
    'DeathDeleteUnequipped',
    'DeathSkillsReset',
    'DeathKeepInventory',
    'NoBuildCost',
    'NoCraftCost',
    'AllPiecesUnlocked',
    'NoWorkbench',
    'AllRecipesUnlocked',
    'WorldLevelLockedTools',
    'PassiveMobs',
    'NoMap',
    'NoPortals',
    'NoBossPortals',
    'DungeonBuild',
    'TeleportAll',
    'NoPseudoDrops',
    'NoBuildingFall',
    'NoHeavySnow',
    'AllHeavySnow',
    'Preset'
  ].map((key) => key.toLowerCase())
);

export function keyCategory(key: string): 'boss' | 'mini_boss' | 'modifier' | 'other' {
  if (isBossKey(key)) return 'boss';
  if (isMiniBossKey(key)) return 'mini_boss';
  if (modifierKeys.has(key.toLowerCase())) return 'modifier';
  return 'other';
}

const creatureNames: Readonly<Record<string, string>> = {
  boar: 'Boar',
  boar_piggy: 'Piggy',
  deer: 'Deer',
  neck: 'Neck',
  greyling: 'Greyling',
  greydwarf: 'Greydwarf',
  greydwarf_shaman: 'Greydwarf shaman',
  greydwarf_elite: 'Greydwarf brute',
  greydwarf_frozen: 'Greydwarf',
  greydwarf_shaman_frozen: 'Greydwarf shaman',
  troll: 'Troll',
  troll_sleeping: 'Troll',
  troll_summoned: 'Summoned troll',
  trollfrost: 'Gammeltroll',
  skeleton: 'Skeleton',
  skeleton_noarcher: 'Skeleton',
  skeleton_meadows: 'Skeleton',
  skeleton_meadows_noarcher: 'Skeleton',
  skeleton_swamps: 'Skeleton',
  skeleton_swamps_noarcher: 'Skeleton',
  skeleton_mountains: 'Skeleton',
  skeleton_mountains_noarcher: 'Skeleton',
  skeleton_deepnorth: 'Skeleton',
  skeleton_aspect: 'Skeleton',
  skeleton_friendly: 'Skelett',
  skeleton_poison: 'Rancid remains',
  skeleton_hildir: 'Brenna',
  skeleton_hildir_nochest: 'Brenna',
  ghost: 'Ghost',
  ghost_sleeping: 'Ghost',
  ghost_old: 'The Void',
  ghost_void: 'The Void',
  blob: 'Blob',
  blobaspect: 'Blob',
  blobelite: 'Oozer',
  blobtar: 'Growth',
  blobfrost: 'Frost blob',
  bloblava: 'Lava blob',
  blobmork: 'Shapeless pulp',
  blobmorkmini: 'Tiny pulp',
  draugr: 'Draugr',
  draugr_sleeping: 'Draugr',
  draugr_ranged: 'Draugr archer',
  draugr_ranged_sleeping: 'Draugr archer',
  draugr_elite: 'Draugr elite',
  draugr_elite_sleeping: 'Draugr elite',
  leech: 'Leech',
  leech_cave: 'Leech',
  surtling: 'Surtling',
  wraith: 'Wraith',
  abomination: 'Abomination',
  wolf: 'Wolf',
  wolf_cub: 'Wolf cub',
  hatchling: 'Drake',
  stonegolem: 'Stone golem',
  fenring: 'Fenring',
  fenring_cultist: 'Cultist',
  fenring_cultist_hildir: 'Geirrhafa',
  fenring_cultist_hildir_nochest: 'Geirrhafa',
  ulv: 'Ulv',
  bat: 'Bat',
  bat_swamp: 'Bat',
  goblin: 'Fuling',
  goblinarcher: 'Fuling archer',
  goblinshaman: 'Fuling shaman',
  goblinbrute: 'Fuling berserker',
  goblin_gem: 'Riktig Fuling',
  goblindeepnorth: 'Captive Fuling',
  goblinshaman_hildir: 'Zil',
  goblinshaman_hildir_nochest: 'Zil',
  goblinbrute_hildir: 'Thungr',
  goblinbrutebros: 'Zil & Thungr',
  goblinbrutebros_nochest: 'Zil & Thungr',
  lox: 'Lox',
  lox_calf: 'Lox calf',
  deathsquito: 'Deathsquito',
  serpent: 'Serpent',
  seeker: 'Seeker',
  seekerbrute: 'Seeker soldier',
  seekerbrood: 'Seeker brood',
  tick: 'Tick',
  gjall: 'Gjall',
  dverger: 'Dvergr',
  dvergerashlands: 'Dvergr rogue',
  dvergerdeepnorth: 'Imprisoned Dvergr',
  dvergermage: 'Dvergr mage',
  dvergermagefire: 'Dvergr fire mage',
  dvergermageice: 'Dvergr frost mage',
  dvergermagesupport: 'Dvergr support mage',
  hare: 'Hare',
  chicken: 'Chicken',
  hen: 'Hen',
  charred_archer: 'Charred archer',
  charred_archer_fader: 'Summoned charred warrior',
  charred_mage: 'Charred warlock',
  charred_melee: 'Charred warrior',
  charred_melee_fader: 'Summoned charred warrior',
  charred_melee_dyrnwyn: 'Lord Reto',
  charred_twitcher: 'Twitcher',
  charred_twitcher_summoned: 'Summoned twitcher',
  morgen: 'Morgen',
  morgen_nonsleeping: 'Morgen',
  volture: 'Volture',
  bonemawserpent: 'Bonemaw serpent',
  asksvin: 'Asksvin',
  asksvin_hatchling: 'Asksvin hatchling',
  fallenvalkyrie: 'Fallen Valkyrie',
  fallenwarrior: 'Fallen warrior',
  bogwitchkvastur: 'Kvastur',
  barka: 'Barka',
  mistile: 'Mistile',
  tendril: 'Tendril',
  tendril_back: 'Root',
  tentaroot: 'Root',
  tentaroot_wild: 'Root',
  staff_greenroots_tentaroot: 'Summoned root',
  writhan: 'Writhan',
  bjorn: 'Bear',
  bjorn_sleeping: 'Bear',
  unbjorn: 'Vile',
  moose: 'Moose',
  moose_calf: 'Moose calf',
  seal: 'Seal',
  seal_pup: 'Baby seal',
  frysling: 'Frysling',
  shadowperson: 'Shadow',
  elaking: 'Elaking',
  elakinglantern: 'Elaking',
  elakingmole: 'Eyeless One',
  jotunwarrior: 'Krigen',
  jotunwarriordualwield: 'Krigen',
  jotunwitch: 'Hexen',
  aspect_eikthyr: 'Aspect of the Lightning Stag',
  aspect_elder: 'Aspect of the Living Forest',
  aspect_bonemass: 'Aspect of the Writhing Dead',
  aspect_moder: 'Aspect of the Dragon Mother',
  aspect_yagluth: 'Aspect of the Twisted Soul',
  aspect_seekerqueen: 'Aspect of the Crawling Matriarch',
  aspect_fader: 'Aspect of the Emerald Flame',
  aspect_tentaroot: 'Root',
  trainingdummy: 'Training dummy',
  piece_trainingdummy: 'T.W.I.G.',
  eikthyr: 'Eikthyr',
  gd_king: 'The Elder',
  bonemass: 'Bonemass',
  dragon: 'Moder',
  goblinking: 'Yagluth',
  seekerqueen: 'The Queen',
  fader: 'Fader',
  frozenking: 'Kall Fimbulbringer',
  frozenking_p2: 'Kall Fimbulbringer',
  frozenking_p3: 'Kall Fimbulbringer'
};

export function creatureName(prefab: string): string {
  const base = prefab.replace(/_ragdoll$/i, '');
  const known = creatureNames[base.toLowerCase()];
  if (known) return known;
  return base.replace(/_/g, ' ');
}

export function isBossPrefab(prefab: string): boolean {
  return bossForPrefab(prefab)?.tier === 'forsaken';
}

export const platforms = ['Steam', 'Xbox', 'PlayStation', 'Nintendo'] as const;
export type PlatformName = (typeof platforms)[number];

export function platformOf(platformUserId: string, fallback?: string | null): PlatformName {
  const prefix = platformUserId.split('_')[0] ?? '';
  const candidate = (platforms as readonly string[]).includes(prefix)
    ? prefix
    : (fallback ?? 'Steam');
  return (platforms as readonly string[]).includes(candidate)
    ? (candidate as PlatformName)
    : 'Steam';
}

const displayPrefixes: Readonly<Record<string, string>> = {
  Steam: 'V',
  Xbox: 'X',
  PlayStation: 'S',
  Nintendo: 'N',
  GameCenter: 'A'
};

const filteredPlatforms = new Set(['Xbox', 'PlayStation', 'Nintendo', 'GameCenter']);

export function displayIdOf(platformUserId: string): string {
  const underscore = platformUserId.indexOf('_');
  if (underscore <= 0) return platformUserId;
  const platform = platformUserId.slice(0, underscore);
  const userId = platformUserId.slice(underscore + 1);
  const prefix = displayPrefixes[platform] ?? platform;
  if (/^\d+$/.test(userId) && filteredPlatforms.has(platform)) {
    const filtered = (BigInt(userId) * 11400714819323198485n) & 0xffffffffffffffffn;
    return `${prefix}_${filtered.toString()}`;
  }
  return `${prefix}_${userId}`;
}

export const worldDayLengthSeconds = 1800;
export const worldRadiusMetres = 10000;
