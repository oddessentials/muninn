import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ActivityItem, EventType } from '../src/lib/api/types.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const site = process.env.RIG_SITE_URL ?? 'http://localhost:3000';
const startedAt = new Date();
const results: { step: string; ok: boolean; detail: string }[] = [];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message: string) => console.log(`[test:rig] ${message}`);

function run(
  command: string,
  args: string[],
  options: { capture?: boolean; allowFailure?: boolean } = {}
): string {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status}${options.capture ? `: ${(result.stderr ?? '').trim()}` : ''}`
    );
  }
  return (result.stdout ?? '').trim();
}

const npm = (script: string, ...args: string[]) =>
  run('npm', ['run', '-s', script, ...(args.length ? ['--', ...args] : [])]);
const rcon = (command: string) =>
  run('npm', ['run', '-s', 'rig:rcon', '--', command], { capture: true });
const compose = (...args: string[]) => run('docker', ['compose', ...args]);

async function waitForHealth(timeoutMs = 180_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${site}/api/v1/health`);
      if (response.ok) {
        const body = (await response.json()) as { db: boolean; mock: boolean };
        if (body.db && !body.mock) return;
      }
    } catch {
      await sleep(0);
    }
    await sleep(2000);
  }
  throw new Error(`${site} did not become healthy within ${timeoutMs / 1000} s`);
}

async function activity(type: EventType, since: Date): Promise<ActivityItem[]> {
  const url = `${site}/api/v1/activity?types=${type}&since=${encodeURIComponent(since.toISOString())}&limit=100`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return ((await response.json()) as { items: ActivityItem[] }).items;
}

async function expectEvent(
  step: string,
  type: EventType,
  since: Date,
  predicate: (item: ActivityItem) => boolean = () => true,
  timeoutMs = 120_000
): Promise<ActivityItem> {
  const started = Date.now();
  let lastCount = 0;
  while (Date.now() - started < timeoutMs) {
    const items = await activity(type, since);
    lastCount = items.length;
    const match = items.find(predicate);
    if (match) {
      results.push({ step, ok: true, detail: `${type} ${match.id} at ${match.at}` });
      log(`ok: ${step} (${type})`);
      return match;
    }
    await sleep(2500);
  }
  results.push({
    step,
    ok: false,
    detail: `${type} not seen within ${timeoutMs / 1000} s (${lastCount} candidates)`
  });
  throw new Error(`${step}: no ${type} event within ${timeoutMs / 1000} s`);
}

async function currentPosition(playerId: number): Promise<{ x: number; z: number }> {
  const response = await fetch(`${site}/api/v1/online`);
  const online = (await response.json()) as {
    items: { player_id: number; x: number; z: number }[];
  };
  const entry = online.items.find((item) => item.player_id === playerId);
  if (!entry) throw new Error('the tester is not online');
  return { x: entry.x, z: entry.z };
}

async function adminCookie(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!password) throw new Error('ADMIN_PASSWORD is not set; the rig needs the admin API');
  const response = await fetch(`${site}/api/v1/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: site },
    body: JSON.stringify({ password })
  });
  if (response.status !== 204) throw new Error(`admin login answered ${response.status}`);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('admin login set no cookie');
  return cookie;
}

async function announce(
  cookie: string,
  body: Record<string, unknown>
): Promise<{ id: number; status: string }> {
  const response = await fetch(`${site}/api/v1/admin/announcements`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: site, cookie },
    body: JSON.stringify(body)
  });
  if (response.status !== 201) {
    throw new Error(`announcement refused with ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as { id: number; status: string };
}

function parseObjectId(listing: string): string | null {
  const match = /(\d+:-?\d+)/.exec(listing);
  return match ? match[1]! : null;
}

async function slay(
  prefab: string,
  spot: { x: number; z: number },
  offset: { x: number; z: number },
  spawn = true
): Promise<void> {
  if (spawn) {
    rcon(`spawn ${prefab} ${(spot.x + offset.x).toFixed(0)} 40 ${(spot.z + offset.z).toFixed(0)}`);
  }
  let id: string | null = null;
  for (let attempt = 0; attempt < 12 && !id; attempt++) {
    await sleep(5000);
    id = parseObjectId(
      rcon(`findObjects -near ${spot.x.toFixed(0)} 40 ${spot.z.toFixed(0)} 120 -prefab ${prefab}`)
    );
  }
  if (!id) throw new Error(`could not find a ${prefab} near the tester`);
  rcon(`modifyObject ${id} -health 0 -force`);
}

async function bossRow(key: string): Promise<{
  tier: string;
  kills: number;
  summons: number;
  defeat: { observed: boolean } | null;
  events: { kind: string; phase: number | null }[];
}> {
  const response = await fetch(`${site}/api/v1/bosses/${key}`);
  if (!response.ok) throw new Error(`/api/v1/bosses/${key} answered ${response.status}`);
  return (await response.json()) as Awaited<ReturnType<typeof bossRow>>;
}

function check(step: string, ok: boolean, detail: string): void {
  results.push({ step, ok, detail });
  log(`${ok ? 'ok' : 'FAILED'}: ${step} (${detail})`);
  if (!ok) throw new Error(`${step}: ${detail}`);
}

async function main(): Promise<void> {
  log(`site ${site}, run started ${startedAt.toISOString()}`);
  compose('build', 'web');
  compose('up', '-d', 'db', 'web');
  await waitForHealth();
  log('web container healthy');
  run('dotnet', ['build', 'plugin', '-nologo', '-v', 'q']);
  npm('rig:down');
  rmSync(join(root, 'local', 'valheim', 'config', 'bepinex', 'GuildTelemetry'), {
    recursive: true,
    force: true
  });
  npm('rig:up');
  await expectEvent(
    'server.started reaches the site',
    'server.started',
    startedAt,
    () => true,
    180_000
  );
  npm('rig:character');
  npm('rig:join', '--replace');
  const joined = await expectEvent(
    'player.joined',
    'player.joined',
    startedAt,
    (item) => item.summary.name === 'Tester'
  );
  const playerId = joined.player?.id;
  if (!playerId) throw new Error('the joined event carries no player reference');
  const player = (await (await fetch(`${site}/api/v1/players/${playerId}`)).json()) as {
    platform_user_id: string;
  };
  const steamId = player.platform_user_id.replace(/^Steam_/, '');
  await expectEvent(
    'player.spawned',
    'player.spawned',
    startedAt,
    (item) => item.player?.id === playerId
  );
  await sleep(5000);
  const position = await currentPosition(playerId);
  log(`tester ${steamId} at ${position.x}, ${position.z}`);

  const deathAt = new Date();
  rcon(`damage ${steamId} 100000`);
  await expectEvent(
    'player.died from an RCON damage',
    'player.died',
    deathAt,
    (item) => item.player?.id === playerId
  );
  await expectEvent(
    'player.spawned after respawn',
    'player.spawned',
    deathAt,
    (item) => item.player?.id === playerId && item.summary.respawn === true,
    90_000
  );

  const saveAt = new Date();
  rcon('save');
  await expectEvent('world.saved', 'world.saved', saveAt);

  await sleep(3000);
  const spot = await currentPosition(playerId);
  const raidAt = new Date();
  rcon(`startEvent army_eikthyr ${spot.x.toFixed(0)} 40 ${spot.z.toFixed(0)}`);
  await expectEvent(
    'raid.started',
    'raid.started',
    raidAt,
    (item) => item.summary.name === 'army_eikthyr'
  );
  rcon('stopEvent');
  await expectEvent(
    'raid.ended with the game timer',
    'raid.ended',
    raidAt,
    (item) => item.summary.name === 'army_eikthyr' && typeof item.summary.active_s === 'number'
  );

  const bossAt = new Date();
  rcon(`spawn Eikthyr ${(spot.x + 12).toFixed(0)} 40 ${(spot.z + 12).toFixed(0)}`);
  await expectEvent(
    'boss.summoned',
    'boss.summoned',
    bossAt,
    (item) => item.summary.prefab === 'Eikthyr'
  );
  await sleep(8000);
  const bossListing = rcon(
    `findObjects -near ${spot.x.toFixed(0)} 40 ${spot.z.toFixed(0)} 80 -prefab Eikthyr`
  );
  const bossId = parseObjectId(bossListing);
  if (!bossId) throw new Error(`could not find the spawned boss: ${bossListing.slice(0, 200)}`);
  rcon(`modifyObject ${bossId} -health 0 -force`);
  await expectEvent(
    'boss.defeated',
    'boss.defeated',
    bossAt,
    (item) => item.summary.key === 'defeated_eikthyr',
    180_000
  );

  const writhanAt = new Date();
  await slay('Writhan', spot, { x: -14, z: 10 });
  const writhanKey = await expectEvent(
    'a mini-boss kill arrives as a global key with its creature',
    'global_key.set',
    writhanAt,
    (item) => item.summary.key === 'defeated_writhan' && item.summary.prefab === 'Writhan',
    180_000
  );
  check(
    'the mini-boss key names the sender',
    typeof writhanKey.summary.sender === 'object' && writhanKey.summary.sender !== null,
    JSON.stringify(writhanKey.summary.sender)
  );
  const writhan = await bossRow('defeated_writhan');
  check(
    'Writhan is a mini-boss row with the kill',
    writhan.tier === 'mini' && writhan.kills >= 1 && writhan.defeat !== null,
    `tier ${writhan.tier}, kills ${writhan.kills}`
  );

  const kallAt = new Date();
  await slay('FrozenKing', spot, { x: 20, z: -20 });
  await expectEvent(
    'phase one of Kall Fimbulbringer falls',
    'boss.defeated',
    kallAt,
    (item) => item.summary.key === 'defeated_frozenking',
    180_000
  );
  await slay('FrozenKing_p2', spot, { x: 20, z: -20 }, false);
  await expectEvent(
    'phase three appears',
    'boss.summoned',
    kallAt,
    (item) => item.summary.prefab === 'FrozenKing_p3',
    180_000
  );
  await slay('FrozenKing_p3', spot, { x: 20, z: -20 }, false);
  await expectEvent(
    'Kall Fimbulbringer is defeated',
    'boss.defeated',
    kallAt,
    (item) => item.summary.key === 'defeated_frozenking_p3',
    180_000
  );
  const kall = await bossRow('defeated_frozenking_p3');
  const kinds = kall.events.map((event) => `${event.kind}:${event.phase}`);
  check(
    'the three phases fold into one Forsaken with one kill',
    kall.tier === 'forsaken' &&
      kall.kills === 1 &&
      kall.summons === 1 &&
      kinds.includes('phase:1') &&
      kinds.includes('summoned:2') &&
      kinds.includes('defeated:3'),
    `kills ${kall.kills}, summons ${kall.summons}, events ${kinds.join(' ')}`
  );

  const structureAt = new Date();
  rcon(`spawn piece_workbench ${(spot.x + 4).toFixed(0)} 40 ${(spot.z + 4).toFixed(0)}`);
  await expectEvent(
    'structure.built',
    'structure.built',
    structureAt,
    (item) => item.summary.prefab === 'piece_workbench'
  );

  const creatureAt = new Date();
  rcon(`spawn Boar ${(spot.x + 6).toFixed(0)} 40 ${(spot.z - 6).toFixed(0)}`);
  await sleep(6000);
  const boarListing = rcon(
    `findObjects -near ${spot.x.toFixed(0)} 40 ${spot.z.toFixed(0)} 60 -prefab Boar`
  );
  const boarId = parseObjectId(boarListing);
  if (!boarId) throw new Error(`could not find the spawned boar: ${boarListing.slice(0, 200)}`);
  rcon(`modifyObject ${boarId} -health 0 -force`);
  await expectEvent(
    'creature.died',
    'creature.died',
    creatureAt,
    (item) => item.summary.prefab === 'Boar'
  );

  const chatAt = new Date();
  rcon('say hello from the rig');
  await expectEvent(
    'chat.message',
    'chat.message',
    chatAt,
    (item) => item.summary.text === 'hello from the rig'
  );

  const cookie = await adminCookie();
  const announceAt = new Date();
  const messageText = `Rig announcement ${announceAt.getTime()}`;
  const posted = await announce(cookie, { kind: 'message', text: messageText });
  log(`announcement ${posted.id} queued (${posted.status})`);
  await expectEvent(
    'announcement.shown for a one-off message',
    'announcement.shown',
    announceAt,
    (item) => item.summary.announcement_id === posted.id && item.summary.text === messageText
  );
  const restartAt = new Date(Date.now() + 90_000);
  const restart = await announce(cookie, {
    kind: 'restart',
    restart_at: restartAt.toISOString(),
    text: 'rig'
  });
  log(`restart ${restart.id} scheduled for ${restartAt.toISOString()}`);
  await expectEvent(
    'announcement.shown opens the restart countdown',
    'announcement.shown',
    announceAt,
    (item) => item.summary.announcement_id === restart.id && item.summary.final === false
  );
  await expectEvent(
    'announcement.shown closes the restart countdown at the time',
    'announcement.shown',
    announceAt,
    (item) =>
      item.summary.announcement_id === restart.id &&
      item.summary.final === true &&
      item.summary.remaining_s === 0,
    180_000
  );
  const listed = (await (
    await fetch(`${site}/api/v1/admin/announcements`, { headers: { cookie } })
  ).json()) as { items: { id: number; status: string }[] };
  const shown = listed.items.filter(
    (item) => (item.id === posted.id || item.id === restart.id) && item.status === 'shown'
  );
  results.push({
    step: 'both announcements report shown on the admin list',
    ok: shown.length === 2,
    detail: listed.items
      .filter((item) => item.id === posted.id || item.id === restart.id)
      .map((item) => `${item.id}:${item.status}`)
      .join(' ')
  });
  if (shown.length !== 2) throw new Error('announcement statuses did not reach shown');
  log('ok: both announcements report shown on the admin list');

  const mapDeadline = Date.now() + 420_000;
  let mapDetail = 'map.available stayed false';
  while (Date.now() < mapDeadline) {
    const world = (await (await fetch(`${site}/api/v1/world`)).json()) as {
      map: { available: boolean; size_px: number | null } | null;
    };
    if (world.map?.available && world.map.size_px === 2048) {
      const image = await fetch(`${site}/api/v1/world/map.png`);
      mapDetail = `${image.status} ${image.headers.get('content-type')} ${image.headers.get('content-length')} bytes`;
      if (image.status === 200) break;
    }
    await sleep(5000);
  }
  const mapOk = mapDetail.startsWith('200 ');
  results.push({
    step: 'world map rendered and uploaded by the plugin',
    ok: mapOk,
    detail: mapDetail
  });
  if (!mapOk) throw new Error(`world map: ${mapDetail}`);
  log('ok: world map rendered and uploaded by the plugin');

  const leaveAt = new Date();
  npm('rig:leave');
  await expectEvent(
    'player.left after the client was ended',
    'player.left',
    leaveAt,
    (item) => item.player?.id === playerId
  );

  compose('stop', 'web');
  log('web stopped; triggering a save while the site is down');
  const replayAt = new Date();
  rcon('save');
  await sleep(8000);
  compose('start', 'web');
  await waitForHealth();
  await expectEvent(
    'world.saved replayed from the journal after the web restart',
    'world.saved',
    replayAt,
    () => true,
    180_000
  );

  const stopAt = new Date();
  npm('rig:down');
  await expectEvent('server.stopping', 'server.stopping', stopAt, () => true, 120_000);
}

main()
  .then(() => {
    console.log('\nStep results');
    for (const result of results)
      console.log(`  ${result.ok ? 'PASS' : 'FAIL'}  ${result.step}: ${result.detail}`);
    const failed = results.filter((result) => !result.ok).length;
    console.log(`\ntest:rig ${failed === 0 ? 'passed' : `failed (${failed} step(s))`}`);
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.log('\nStep results');
    for (const result of results)
      console.log(`  ${result.ok ? 'PASS' : 'FAIL'}  ${result.step}: ${result.detail}`);
    console.error(`test:rig failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
