import { createSocket } from 'node:dgram';

export interface A2sInfo {
  name: string;
  map: string;
  folder: string;
  game: string;
  players: number;
  maxPlayers: number;
  bots: number;
  serverType: string;
  environment: string;
  visibility: number;
  version: string;
  port: number | null;
  keywords: string | null;
  gameVersion: string | null;
  networkVersion: number | null;
  rttMs: number;
}

export interface A2sPlayer {
  index: number;
  name: string;
  score: number;
  durationS: number;
}

const header = Buffer.from([0xff, 0xff, 0xff, 0xff]);
const infoRequest = Buffer.concat([
  header,
  Buffer.from([0x54]),
  Buffer.from('Source Engine Query\0', 'ascii')
]);
const playerRequest = Buffer.concat([header, Buffer.from([0x55, 0xff, 0xff, 0xff, 0xff])]);

function cstring(buffer: Buffer, offset: number): [string, number] {
  let end = offset;
  while (end < buffer.length && buffer[end] !== 0) end++;
  return [buffer.toString('utf8', offset, end), end + 1];
}

export function parseKeywords(keywords: string | null): {
  gameVersion: string | null;
  networkVersion: number | null;
} {
  if (!keywords) return { gameVersion: null, networkVersion: null };
  const parts = Object.fromEntries(
    keywords.split(',').map((part) => {
      const eq = part.indexOf('=');
      return eq === -1 ? [part, ''] : [part.slice(0, eq), part.slice(eq + 1)];
    })
  ) as Record<string, string>;
  const network = parts.n !== undefined && /^\d+$/.test(parts.n) ? Number(parts.n) : null;
  return { gameVersion: parts.g || null, networkVersion: network };
}

export function parseInfo(message: Buffer, rttMs: number): A2sInfo {
  let offset = 6;
  const readString = (): string => {
    const [value, next] = cstring(message, offset);
    offset = next;
    return value;
  };
  const readByte = (): number => message[offset++] ?? 0;
  const name = readString();
  const map = readString();
  const folder = readString();
  const game = readString();
  offset += 2;
  const players = readByte();
  const maxPlayers = readByte();
  const bots = readByte();
  const serverType = String.fromCharCode(readByte());
  const environment = String.fromCharCode(readByte());
  const visibility = readByte();
  offset += 1;
  const version = readString();
  let port: number | null = null;
  let keywords: string | null = null;
  if (offset < message.length) {
    const edf = readByte();
    if (edf & 0x80) {
      port = message.readUInt16LE(offset);
      offset += 2;
    }
    if (edf & 0x10) offset += 8;
    if (edf & 0x40) {
      offset += 2;
      readString();
    }
    if (edf & 0x20) keywords = readString();
  }
  const parsed = parseKeywords(keywords);
  return {
    name,
    map,
    folder,
    game,
    players,
    maxPlayers,
    bots,
    serverType,
    environment,
    visibility,
    version,
    port,
    keywords,
    gameVersion: parsed.gameVersion,
    networkVersion: parsed.networkVersion,
    rttMs
  };
}

export function parsePlayers(message: Buffer): A2sPlayer[] {
  let offset = 5;
  const count = message[offset++] ?? 0;
  const players: A2sPlayer[] = [];
  for (let i = 0; i < count && offset < message.length; i++) {
    const index = message[offset++] ?? 0;
    const [name, next] = cstring(message, offset);
    offset = next;
    const score = message.readInt32LE(offset);
    offset += 4;
    const durationS = message.readFloatLE(offset);
    offset += 4;
    players.push({ index, name, score, durationS });
  }
  return players;
}

function exchange(
  host: string,
  port: number,
  request: Buffer,
  expectedType: number,
  timeoutMs: number
): Promise<{ message: Buffer; rttMs: number }> {
  return new Promise((resolve, reject) => {
    const socket = createSocket('udp4');
    const started = Date.now();
    let done = false;
    const finish = (error: Error | null, message?: Buffer) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else resolve({ message: message!, rttMs: Date.now() - started });
    };
    const timer = setTimeout(
      () => finish(new Error(`A2S query timed out after ${timeoutMs} ms`)),
      timeoutMs
    );
    socket.on('error', (error) => finish(error));
    socket.on('message', (message) => {
      if (message.length < 5 || message.readInt32LE(0) !== -1) return;
      const type = message[4];
      if (type === 0x41) {
        const challenge = message.subarray(5, 9);
        const withChallenge =
          request === infoRequest
            ? Buffer.concat([request, challenge])
            : Buffer.concat([request.subarray(0, 5), challenge]);
        socket.send(withChallenge, port, host);
        return;
      }
      if (type === expectedType) finish(null, message);
    });
    socket.send(request, port, host, (error) => {
      if (error) finish(error);
    });
  });
}

export async function queryInfo(host: string, port: number, timeoutMs = 3000): Promise<A2sInfo> {
  const { message, rttMs } = await exchange(host, port, infoRequest, 0x49, timeoutMs);
  return parseInfo(message, rttMs);
}

export async function queryPlayers(
  host: string,
  port: number,
  timeoutMs = 3000
): Promise<A2sPlayer[]> {
  const { message } = await exchange(host, port, playerRequest, 0x44, timeoutMs);
  return parsePlayers(message);
}

export function buildInfoReply(fields: {
  name: string;
  map?: string;
  players: number;
  maxPlayers: number;
  keywords?: string;
  port?: number;
}): Buffer {
  const parts = [
    header,
    Buffer.from([0x49, 0x11]),
    Buffer.from(`${fields.name}\0`, 'utf8'),
    Buffer.from(`${fields.map ?? fields.name}\0`, 'utf8'),
    Buffer.from('valheim\0', 'utf8'),
    Buffer.from('\0', 'utf8'),
    Buffer.from([0, 0, fields.players, fields.maxPlayers, 0, 0x64, 0x77, 1, 0]),
    Buffer.from('1.0.0.0\0', 'utf8')
  ];
  const edf = (fields.port !== undefined ? 0x80 : 0) | (fields.keywords !== undefined ? 0x20 : 0);
  parts.push(Buffer.from([edf]));
  if (fields.port !== undefined) {
    const portBuffer = Buffer.alloc(2);
    portBuffer.writeUInt16LE(fields.port);
    parts.push(portBuffer);
  }
  if (fields.keywords !== undefined) parts.push(Buffer.from(`${fields.keywords}\0`, 'utf8'));
  return Buffer.concat(parts);
}

export function buildPlayerReply(players: { name: string; durationS: number }[]): Buffer {
  const parts = [header, Buffer.from([0x44, players.length])];
  for (const player of players) {
    const tail = Buffer.alloc(8);
    tail.writeInt32LE(0, 0);
    tail.writeFloatLE(player.durationS, 4);
    parts.push(Buffer.from([0]), Buffer.from(`${player.name}\0`, 'utf8'), tail);
  }
  return Buffer.concat(parts);
}

export function isInfoRequest(message: Buffer): boolean {
  return message.length >= 5 && message[4] === 0x54;
}

export function isPlayerRequest(message: Buffer): boolean {
  return message.length >= 5 && message[4] === 0x55;
}
