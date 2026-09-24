import { generateHistory, toBatches, type SimulatedHistory } from './simulator/generator.ts';
import { placeholderMap } from './lib/png.ts';
import { signBatch, signMap } from '../src/lib/server/ingest/signature.ts';
import type { IngestBatch, TelemetryEvent } from '../src/lib/api/types.ts';

interface Options {
  url: string;
  secret: string;
  days: number;
  seed: number;
  live: boolean;
  map: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    url: process.env.SIMULATE_URL ?? 'http://localhost:3000/api/ingest',
    secret: process.env.TELEMETRY_SECRET ?? '',
    days: 45,
    seed: 20260910,
    live: false,
    map: true,
    dryRun: false
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = () => argv[++i] ?? '';
    if (arg === '--url') options.url = next();
    else if (arg === '--secret') options.secret = next();
    else if (arg === '--days') options.days = Number(next());
    else if (arg === '--seed') options.seed = Number(next());
    else if (arg === '--live') options.live = true;
    else if (arg === '--no-map') options.map = false;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg !== '--') throw new Error(`unknown argument ${arg}`);
  }
  if (!options.secret)
    throw new Error('TELEMETRY_SECRET is not set; pass --secret or run through npm run simulate');
  return options;
}

async function postBatch(
  options: Options,
  batch: IngestBatch
): Promise<{ accepted: number; duplicates: number }> {
  const body = JSON.stringify(batch);
  const timestamp = Math.floor(Date.now() / 1000);
  const response = await fetch(options.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telemetry-timestamp': String(timestamp),
      'x-telemetry-signature': signBatch(options.secret, timestamp, body)
    },
    body
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ingest answered ${response.status}: ${text.slice(0, 300)}`);
  }
  return (await response.json()) as { accepted: number; duplicates: number };
}

async function postMap(options: Options, history: SimulatedHistory): Promise<void> {
  const size = 512;
  const png = placeholderMap(size);
  const timestamp = Math.floor(Date.now() / 1000);
  const mapUrl = options.url.replace(/\/api\/ingest\/?$/, '/api/ingest/map');
  const response = await fetch(mapUrl, {
    method: 'POST',
    headers: {
      'content-type': 'image/png',
      'x-telemetry-timestamp': String(timestamp),
      'x-telemetry-signature': signMap(options.secret, timestamp, png),
      'x-world-uid': String(history.world.uid),
      'x-map-size': String(size),
      'x-map-radius': '10000'
    },
    body: new Uint8Array(png)
  });
  if (!response.ok)
    throw new Error(
      `map upload answered ${response.status}: ${(await response.text()).slice(0, 300)}`
    );
}

function liveEvents(
  history: SimulatedHistory,
  seq: { value: number },
  netTime: { value: number },
  uptime: { value: number }
): TelemetryEvent[] {
  const now = new Date();
  const runId = history.runIds[history.runIds.length - 1]!;
  const out: TelemetryEvent[] = [];
  const players = history.onlineAtEnd;
  const worldDay = Math.floor(netTime.value / 1800);
  for (const player of players) {
    seq.value += 1;
    out.push({
      id: crypto.randomUUID(),
      seq: seq.value,
      run_id: runId,
      ts: now.toISOString(),
      type: 'player.position',
      world_day: worldDay,
      data: {
        platform_user_id: player.platformUserId,
        x: Math.round((player.home.x + Math.sin(Date.now() / 20000) * 40) * 10) / 10,
        z: Math.round((player.home.z + Math.cos(Date.now() / 20000) * 40) * 10) / 10,
        biome: 'Meadows'
      }
    });
  }
  seq.value += 1;
  out.push({
    id: crypto.randomUUID(),
    seq: seq.value,
    run_id: runId,
    ts: now.toISOString(),
    type: 'server.heartbeat',
    world_day: worldDay,
    data: {
      uptime_s: Math.round(uptime.value),
      net_time: Math.round(netTime.value),
      world_day: worldDay,
      last_save_age_s: 600,
      queue_depth: 0,
      dropped_events: 0,
      players: players.map((player) => ({
        platform_user_id: player.platformUserId,
        name: player.name,
        character_id: player.characterId,
        biome: 'Meadows',
        x: player.home.x,
        z: player.home.z,
        distance_since_last_m: 12.5
      }))
    }
  });
  return out;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const history = generateHistory({ days: options.days, seed: options.seed });
  const batches = toBatches(history);
  console.log(
    `simulate: ${history.events.length} events across ${history.runIds.length} runs in ${batches.length} batches`
  );
  if (options.dryRun) return;
  let accepted = 0;
  let duplicates = 0;
  for (const [index, batch] of batches.entries()) {
    const result = await postBatch(options, batch);
    accepted += result.accepted;
    duplicates += result.duplicates;
    if ((index + 1) % 25 === 0 || index === batches.length - 1) {
      console.log(
        `simulate: ${index + 1}/${batches.length} batches, ${accepted} accepted, ${duplicates} duplicates`
      );
    }
  }
  if (options.map) {
    await postMap(options, history);
    console.log('simulate: map image uploaded');
  }
  if (!options.live) return;
  const lastEvent = history.events[history.events.length - 1]!;
  const lastHeartbeat = [...history.events]
    .reverse()
    .find((event) => event.type === 'server.heartbeat');
  const seq = { value: lastEvent.seq };
  const netTime = {
    value: lastHeartbeat ? (lastHeartbeat.data as { net_time: number }).net_time : 0
  };
  const uptime = {
    value: lastHeartbeat ? (lastHeartbeat.data as { uptime_s: number }).uptime_s : 0
  };
  console.log(
    'simulate: live mode, streaming heartbeats and positions every 20 s (Ctrl+C to stop)'
  );
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    netTime.value += 20;
    uptime.value += 20;
    const events = liveEvents(history, seq, netTime, uptime);
    await postBatch(options, {
      plugin: history.plugin,
      game: history.game,
      server: { name: history.serverName, world: history.world.name, world_uid: history.world.uid },
      events
    });
    console.log(`simulate: live batch sent (${events.length} events)`);
  }
}

main().catch((error) => {
  console.error(`simulate: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
