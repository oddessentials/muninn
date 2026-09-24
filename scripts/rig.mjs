import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createSocket } from 'node:dgram';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const localDir = join(root, 'local', 'valheim');
const configDir = join(localDir, 'config');
const dataDir = join(localDir, 'data');
const pluginDll = join(root, 'plugin', 'out', 'GuildTelemetry.dll');
const logFile = join(dataDir, 'bepinex', 'BepInEx', 'LogOutput.log');
const rconPluginDir = join(configDir, 'bepinex', 'plugins', 'ValheimRcon');
const rconVersion = '1.6.2';
const rconDownloadUrl = `https://thunderstore.io/package/download/Tristan/ValheimRcon/${rconVersion}/`;
const clientExe =
  process.env.VALHEIM_CLIENT_PATH ?? 'D:\\SteamLibrary\\steamapps\\common\\Valheim\\valheim.exe';
const characterName = 'Tester';
const serverAddress = '127.0.0.1:2456';
const queryPort = 2457;
const rconPort = 2458;
const steamAppId = '892970';
const steamIdBase = 76561197960265728n;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.log(`[rig] ${message}`);

function readEnv() {
  const file = join(root, '.env');
  if (!existsSync(file))
    throw new Error('.env is missing; run npm install to create it from .env.example');
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2];
  }
  for (const key of ['SERVER_PASS', 'RCON_PASSWORD', 'TELEMETRY_SECRET']) {
    if (!values[key]) throw new Error(`${key} is missing from .env`);
  }
  return values;
}

function compose(args, options = {}) {
  const result = spawnSync('docker', ['compose', '--profile', 'valheim', ...args], {
    cwd: root,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8'
  });
  if (result.status !== 0)
    throw new Error(`docker compose ${args.join(' ')} failed with exit code ${result.status}`);
  return result.stdout ?? '';
}

function readLog() {
  return existsSync(logFile) ? readFileSync(logFile, 'utf8') : '';
}

async function waitForLogReset(previous, timeoutMs = 5 * 60_000) {
  const started = Date.now();
  const firstLine = (text) => text.split('\n', 1)[0];
  while (Date.now() - started < timeoutMs) {
    const current = readLog();
    if (
      current.length < previous.length ||
      (current.length > 0 && firstLine(current) !== firstLine(previous))
    )
      return;
    await sleep(250);
  }
  throw new Error('BepInEx did not start a new log after the container restart');
}

async function waitForLog(pattern, { offset = 0, timeoutMs, label }) {
  const started = Date.now();
  let lastReport = 0;
  while (Date.now() - started < timeoutMs) {
    const full = readLog();
    const text = full.length >= offset ? full.slice(offset) : full;
    const match = pattern.exec(text);
    if (match) return match;
    if (Date.now() - lastReport > 30_000) {
      lastReport = Date.now();
      log(`waiting for ${label} (${Math.round((Date.now() - started) / 1000)} s)`);
    }
    await sleep(2000);
  }
  throw new Error(`timed out after ${Math.round(timeoutMs / 1000)} s waiting for ${label}`);
}

function queryA2sInfo(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = createSocket('udp4');
    const header = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]);
    const payload = Buffer.from('Source Engine Query\0', 'ascii');
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    socket.on('error', () => finish(null));
    socket.on('message', (message) => {
      if (message.length < 5) return;
      const type = message[4];
      if (type === 0x41) {
        socket.send(Buffer.concat([header, payload, message.subarray(5, 9)]), port, host);
        return;
      }
      if (type === 0x49) {
        let cursor = 6;
        const readString = () => {
          const end = message.indexOf(0, cursor);
          const value = message.toString('utf8', cursor, end);
          cursor = end + 1;
          return value;
        };
        const name = readString();
        const map = readString();
        readString();
        readString();
        cursor += 2;
        const players = message[cursor];
        const maxPlayers = message[cursor + 1];
        finish({ name, map, players, maxPlayers });
      }
    });
    socket.send(Buffer.concat([header, payload]), port, host);
  });
}

function parseZip(buffer) {
  const signature = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i >= buffer.length - 66_000; i--) {
    if (buffer.readUInt32LE(i) === signature) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('not a zip archive');
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const files = [];
  for (let i = 0; i < entries; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('bad central directory');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    files.push({
      name,
      read: () => (method === 8 ? inflateRawSync(data) : Buffer.from(data))
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

async function ensureRconPlugin() {
  const dll = join(rconPluginDir, 'ValheimRcon.dll');
  if (existsSync(dll)) return;
  log(`downloading ValheimRcon ${rconVersion} from Thunderstore`);
  const response = await fetch(rconDownloadUrl, { redirect: 'follow' });
  if (!response.ok) throw new Error(`ValheimRcon download failed: ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  mkdirSync(rconPluginDir, { recursive: true });
  let extracted = 0;
  for (const entry of parseZip(archive)) {
    if (!entry.name.toLowerCase().endsWith('.dll')) continue;
    writeFileSync(join(rconPluginDir, entry.name.split('/').pop()), entry.read());
    extracted += 1;
  }
  if (extracted === 0) throw new Error('the ValheimRcon package contained no DLL');
  log(`installed ValheimRcon ${rconVersion} into ${rconPluginDir}`);
}

function steamPath() {
  if (process.env.STEAM_PATH) return process.env.STEAM_PATH;
  try {
    const output = execFileSync(
      'reg',
      ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      {
        encoding: 'utf8'
      }
    );
    const match = /SteamPath\s+REG_SZ\s+(.+)/.exec(output);
    if (match) return match[1].trim().replace(/\//g, '\\');
  } catch {
    return 'C:\\Program Files (x86)\\Steam';
  }
  return 'C:\\Program Files (x86)\\Steam';
}

function steamAccount() {
  const userdata = join(steamPath(), 'userdata');
  if (!existsSync(userdata)) throw new Error(`Steam userdata folder not found at ${userdata}`);
  const accounts = readdirSync(userdata).filter((name) => /^\d+$/.test(name));
  const withCharacters = accounts.filter((name) =>
    existsSync(join(userdata, name, steamAppId, 'remote', 'characters'))
  );
  if (withCharacters.length === 0)
    throw new Error(`no Steam account under ${userdata} has a Valheim character cache`);
  const accountId = withCharacters[0];
  return {
    accountId,
    steamId64: (steamIdBase + BigInt(accountId)).toString(),
    charactersDir: join(userdata, accountId, steamAppId, 'remote', 'characters')
  };
}

function writeRigConfig(env) {
  mkdirSync(join(configDir, 'bepinex', 'plugins'), { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  const telemetry = [
    '[General]',
    'Url = http://web:3000/api/ingest',
    `Secret = ${env.TELEMETRY_SECRET}`,
    'HeartbeatSeconds = 60',
    'FlushSeconds = 2',
    'BiomeSampleSeconds = 5',
    'PositionSampleSeconds = 20',
    'JournalMaxMB = 50',
    'AllowInsecureHttp = true',
    'LogEvents = true',
    'MapEnabled = true',
    'CatalogEnabled = true',
    ''
  ].join('\n');
  writeFileSync(join(configDir, 'bepinex', 'com.guildsite.telemetry.cfg'), telemetry);
  const rcon = [
    '[1. Rcon]',
    `Port = ${rconPort}`,
    `Password = ${env.RCON_PASSWORD}`,
    'Whitelist IP mask = ',
    'Blacklist IP mask = ',
    '',
    '[2. Discord]',
    'Webhook url = ',
    '',
    '[3. Chat]',
    'Server name = Rig',
    ''
  ].join('\n');
  writeFileSync(join(configDir, 'bepinex', 'org.tristan.rcon.cfg'), rcon);
  const account = steamAccount();
  writeFileSync(
    join(configDir, 'adminlist.txt'),
    `Steam_${account.steamId64}\nV_${account.steamId64}\n`
  );
  log(`rig config written for tester Steam_${account.steamId64}`);
}

async function up() {
  const env = readEnv();
  if (!existsSync(pluginDll)) {
    log('plugin/out/GuildTelemetry.dll is missing, building the plugin');
    const build = spawnSync('dotnet', ['build', 'plugin'], {
      cwd: root,
      stdio: 'inherit'
    });
    if (build.status !== 0) throw new Error('dotnet build plugin failed');
  }
  writeRigConfig(env);
  await ensureRconPlugin();
  const running = compose(['ps', '--status', 'running', '--services'], { capture: true })
    .split(/\r?\n/)
    .includes('valheim');
  if (!running && existsSync(logFile)) rmSync(logFile);
  let offset = 0;
  compose(['up', '-d', 'valheim']);
  log('valheim container started; the first start downloads the dedicated server (about 1 GB)');
  const pluginLoaded = /GuildTelemetry \S+ loaded on Valheim/;
  const chainloaderDone = /Chainloader startup complete/;
  for (let attempt = 0; ; attempt++) {
    const match = await waitForLog(new RegExp(`${pluginLoaded.source}|${chainloaderDone.source}`), {
      offset,
      timeoutMs: 25 * 60_000,
      label: 'BepInEx to finish loading plugins'
    });
    const seen = readLog();
    if (
      pluginLoaded.test(seen.length >= offset ? seen.slice(offset) : seen) ||
      pluginLoaded.test(match[0])
    )
      break;
    if (attempt >= 1) {
      throw new Error(
        'BepInEx started without GuildTelemetry.dll; check local/valheim/config/bepinex/plugins'
      );
    }
    log(
      'BepInEx started before its plugin folder existed (first install); restarting the container once'
    );
    const previous = readLog();
    compose(['restart', 'valheim']);
    await waitForLogReset(previous);
    offset = 0;
  }
  log('GuildTelemetry plugin loaded');
  const started = Date.now();
  while (Date.now() - started < 10 * 60_000) {
    const info = await queryA2sInfo('127.0.0.1', queryPort);
    if (info) {
      log(`server accepts connections: "${info.name}" ${info.players}/${info.maxPlayers} players`);
      return;
    }
    await sleep(3000);
  }
  throw new Error('the server never answered the Steam query on port 2457');
}

function down() {
  compose(['stop', 'valheim']);
  compose(['rm', '-f', 'valheim']);
  log('valheim container stopped and removed; world data stays in local/valheim');
}

function processRunning(image) {
  const output =
    spawnSync('tasklist', ['/FI', `IMAGENAME eq ${image}`, '/NH'], {
      encoding: 'utf8'
    }).stdout ?? '';
  return output.toLowerCase().includes(image.toLowerCase());
}

async function join_(args) {
  const env = readEnv();
  if (!existsSync(clientExe))
    throw new Error(`Valheim client not found at ${clientExe} (set VALHEIM_CLIENT_PATH)`);
  if (!processRunning('steam.exe'))
    throw new Error('Steam is not running; start Steam before rig:join');
  if (processRunning('valheim.exe')) {
    if (!args.includes('--replace')) {
      throw new Error('valheim.exe is already running; close it or pass --replace to end it first');
    }
    await endClient();
  }
  const characterFile = localCharacterPath();
  if (!existsSync(characterFile))
    throw new Error(`${characterFile} is missing; run npm run rig:character first`);
  const offset = readLog().length;
  const child = spawn(
    clientExe,
    [
      '-console',
      '-joinserverwithcharacter',
      serverAddress,
      characterName,
      'x',
      '-password',
      env.SERVER_PASS
    ],
    { detached: true, stdio: 'ignore', cwd: join(clientExe, '..') }
  );
  child.unref();
  log(`launched ${clientExe} (pid ${child.pid}) joining ${serverAddress} as ${characterName}`);
  const started = Date.now();
  await waitForLog(new RegExp(`GuildTelemetry: player joined ${characterName} \\(`), {
    offset,
    timeoutMs: 8 * 60_000,
    label: `${characterName} to join the rig server`
  });
  log(`${characterName} joined after ${Math.round((Date.now() - started) / 1000)} s`);
  await waitForLog(new RegExp(`Got character ZDOID from ${characterName} : `), {
    offset,
    timeoutMs: 3 * 60_000,
    label: `${characterName} to spawn`
  });
  log(`${characterName} spawned`);
}

async function endClient() {
  spawnSync('taskkill', ['/IM', 'valheim.exe'], { stdio: 'ignore' });
  const started = Date.now();
  while (processRunning('valheim.exe') && Date.now() - started < 10_000) await sleep(1000);
  if (processRunning('valheim.exe')) {
    spawnSync('taskkill', ['/IM', 'valheim.exe', '/F'], { stdio: 'ignore' });
    while (processRunning('valheim.exe')) await sleep(500);
  }
}

async function leave() {
  if (!processRunning('valheim.exe')) {
    log('no valheim.exe process is running');
    return;
  }
  const offset = readLog().length;
  await endClient();
  log('client process ended');
  const started = Date.now();
  await waitForLog(new RegExp(`GuildTelemetry: player left ${characterName} \\(`), {
    offset,
    timeoutMs: 5 * 60_000,
    label: `the server to register ${characterName} leaving`
  });
  log(`${characterName} left after ${Math.round((Date.now() - started) / 1000)} s`);
}

function rconPacket(id, type, body) {
  const payload = Buffer.from(body, 'utf8');
  const packet = Buffer.alloc(14 + payload.length);
  packet.writeInt32LE(10 + payload.length, 0);
  packet.writeInt32LE(id, 4);
  packet.writeInt32LE(type, 8);
  payload.copy(packet, 12);
  return packet;
}

function rcon(command) {
  const env = readEnv();
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port: rconPort });
    let buffer = Buffer.alloc(0);
    let authenticated = false;
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('RCON timed out'));
    }, 15_000);
    socket.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.on('connect', () => socket.write(rconPacket(1, 3, env.RCON_PASSWORD)));
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 4) {
        const size = buffer.readInt32LE(0);
        if (buffer.length < size + 4) break;
        const id = buffer.readInt32LE(4);
        const type = buffer.readInt32LE(8);
        const body = buffer.toString('utf8', 12, size + 2);
        buffer = buffer.subarray(size + 4);
        if (!authenticated) {
          if (id === -1) {
            clearTimeout(timer);
            socket.destroy();
            reject(new Error('RCON authentication failed; check RCON_PASSWORD'));
            return;
          }
          if (id === 1 && type === 2) {
            authenticated = true;
            socket.write(rconPacket(2, 2, command));
          }
          continue;
        }
        if (id === 2) {
          clearTimeout(timer);
          socket.end();
          resolve(body);
          return;
        }
      }
    });
  });
}

function localCharacterPath() {
  return join(
    homedir(),
    'AppData',
    'LocalLow',
    'IronGate',
    'Valheim',
    'characters_local',
    `${characterName}.fch`
  );
}

class PackageReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }
  int() {
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }
  long() {
    const value = this.buffer.readBigInt64LE(this.offset);
    this.offset += 8;
    return value;
  }
  single() {
    this.offset += 4;
  }
  bool() {
    const value = this.buffer[this.offset] !== 0;
    this.offset += 1;
    return value;
  }
  vector3() {
    this.offset += 12;
  }
  bytes() {
    const length = this.int();
    this.offset += length;
  }
  string() {
    let length = 0;
    let shift = 0;
    for (;;) {
      const byte = this.buffer[this.offset++];
      length |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    const value = this.buffer.toString('utf8', this.offset, this.offset + length);
    this.offset += length;
    return value;
  }
  dictionary() {
    const count = this.int();
    for (let i = 0; i < count; i++) {
      this.string();
      this.single();
    }
  }
}

function encodeString(value) {
  const bytes = Buffer.from(value, 'utf8');
  const prefix = [];
  let length = bytes.length;
  do {
    let byte = length & 0x7f;
    length >>= 7;
    if (length > 0) byte |= 0x80;
    prefix.push(byte);
  } while (length > 0);
  return Buffer.concat([Buffer.from(prefix), bytes]);
}

function locateIdentity(data) {
  const reader = new PackageReader(data);
  const version = reader.int();
  if (version < 46)
    throw new Error(
      `character file version ${version} is older than the DeepNorth format this script understands`
    );
  const statCount = reader.int();
  const difficulties = reader.int();
  for (let i = 0; i < difficulties; i++) {
    for (let j = 0; j < statCount; j++) reader.single();
    reader.dictionary();
    reader.dictionary();
    reader.dictionary();
    const enemyDictionaries = reader.int();
    for (let k = 0; k < enemyDictionaries; k++) reader.dictionary();
    reader.dictionary();
    reader.dictionary();
    reader.dictionary();
    reader.dictionary();
    reader.dictionary();
  }
  reader.bool();
  const worlds = reader.int();
  for (let i = 0; i < worlds; i++) {
    reader.long();
    reader.bool();
    reader.vector3();
    reader.bool();
    reader.vector3();
    reader.bool();
    reader.vector3();
    reader.vector3();
    if (reader.bool()) reader.bytes();
  }
  const nameOffset = reader.offset;
  const name = reader.string();
  const idOffset = reader.offset;
  const id = reader.long();
  const afterId = reader.offset;
  reader.string();
  return { version, name, id, nameOffset, idOffset, afterId };
}

function rewriteCharacter(file, newName) {
  const raw = readFileSync(file);
  const length = raw.readInt32LE(0);
  const data = raw.subarray(4, 4 + length);
  const identity = locateIdentity(data);
  const idBytes = Buffer.alloc(8);
  const newId = BigInt.asIntN(
    64,
    BigInt(
      '0x' + createHash('sha256').update(`${newName}:${Date.now()}`).digest('hex').slice(0, 15)
    )
  );
  idBytes.writeBigInt64LE(newId === 0n ? 1n : newId);
  const rewritten = Buffer.concat([
    data.subarray(0, identity.nameOffset),
    encodeString(newName),
    idBytes,
    data.subarray(identity.afterId)
  ]);
  const check = locateIdentity(rewritten);
  if (check.name !== newName) throw new Error('rewrite verification failed');
  const hash = createHash('sha512').update(rewritten).digest();
  const lengthBytes = Buffer.alloc(4);
  lengthBytes.writeInt32LE(rewritten.length);
  const hashLength = Buffer.alloc(4);
  hashLength.writeInt32LE(hash.length);
  return {
    content: Buffer.concat([lengthBytes, rewritten, hashLength, hash]),
    sourceName: identity.name,
    sourceId: identity.id,
    newId: check.id
  };
}

function character() {
  const target = localCharacterPath();
  if (existsSync(target)) {
    log(`${characterName} already exists at ${target}`);
    return;
  }
  const account = steamAccount();
  const candidates = readdirSync(account.charactersDir)
    .filter((name) => name.endsWith('.fch') && !name.includes('_backup_'))
    .map((name) => ({
      name,
      path: join(account.charactersDir, name),
      mtime: statSync(join(account.charactersDir, name)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (candidates.length === 0) throw new Error(`no .fch files in ${account.charactersDir}`);
  const source = candidates[0];
  const result = rewriteCharacter(source.path, characterName);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, result.content);
  log(
    `created ${target} from ${source.name} (was "${result.sourceName}" id ${result.sourceId}, now "${characterName}" id ${result.newId})`
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'up':
      await up();
      break;
    case 'down':
      down();
      break;
    case 'join':
      await join_(args);
      break;
    case 'leave':
      await leave();
      break;
    case 'rcon': {
      const commandLine = args.filter((arg) => arg !== '--').join(' ');
      if (!commandLine) throw new Error('usage: npm run rig:rcon -- <command>');
      const response = await rcon(commandLine);
      console.log(response.trimEnd());
      break;
    }
    case 'character':
      character();
      break;
    default:
      console.error('usage: node scripts/rig.mjs <up|down|join|leave|rcon|character>');
      process.exit(2);
  }
}

main().catch((error) => {
  console.error(`[rig] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
