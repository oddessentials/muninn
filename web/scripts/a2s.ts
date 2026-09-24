import { queryInfo, queryPlayers } from '../src/lib/server/a2s.ts';

const host = process.argv[2] ?? process.env.STEAM_QUERY_HOST ?? '';
const port = Number(process.argv[3] ?? process.env.STEAM_QUERY_PORT ?? 0);
if (!host || !port) {
  console.error(
    'usage: npm run a2s [-- <host> <port>] (defaults to STEAM_QUERY_HOST and STEAM_QUERY_PORT)'
  );
  process.exit(2);
}
const info = await queryInfo(host, port);
const players = await queryPlayers(host, port).catch(() => []);
console.log(
  JSON.stringify(
    {
      host,
      port,
      name: info.name,
      players: info.players,
      max_players: info.maxPlayers,
      game_version: info.gameVersion,
      network_version: info.networkVersion,
      environment: info.environment,
      server_type: info.serverType,
      visibility: info.visibility,
      port_game: info.port,
      rtt_ms: info.rttMs,
      sessions: players.map((player) => Math.round(player.durationS))
    },
    null,
    2
  )
);
