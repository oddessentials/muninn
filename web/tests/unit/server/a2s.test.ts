import { createSocket, type Socket } from 'node:dgram';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildInfoReply,
  buildPlayerReply,
  isInfoRequest,
  isPlayerRequest,
  parseInfo,
  parseKeywords,
  queryInfo,
  queryPlayers
} from '$lib/server/a2s';

const capture = Buffer.from(
  'ffffffff4911526176656e686f6c6400526176656e686f6c640076616c6865696d00000000040a0064770100312e302e302e3000b1b9690100000000004001673d312e302e372c6e3d33392c6d3d002aa00d0000000000',
  'hex'
);

describe('A2S client', () => {
  it('parses a recorded server reply', () => {
    const info = parseInfo(capture, 98);
    expect(info.name).toBe('Ravenhold');
    expect(info.players).toBe(4);
    expect(info.maxPlayers).toBe(10);
    expect(info.environment).toBe('w');
    expect(info.port).toBe(27065);
    expect(info.keywords).toBe('g=1.0.7,n=39,m=');
    expect(info.gameVersion).toBe('1.0.7');
    expect(info.networkVersion).toBe(39);
    expect(parseKeywords(null)).toEqual({ gameVersion: null, networkVersion: null });
  });

  describe('against a fake responder with challenges', () => {
    let socket: Socket;
    let port = 0;

    beforeAll(async () => {
      socket = createSocket('udp4');
      const challenge = Buffer.from([0x11, 0x22, 0x33, 0x44]);
      socket.on('message', (message, remote) => {
        const challenged = message.subarray(message.length - 4).equals(challenge);
        if (!challenged) {
          socket.send(
            Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff, 0x41]), challenge]),
            remote.port,
            remote.address
          );
          return;
        }
        if (isInfoRequest(message)) {
          socket.send(
            buildInfoReply({
              name: 'Guild rig',
              players: 2,
              maxPlayers: 10,
              keywords: 'g=1.0.7,n=39,m=',
              port: 2456
            }),
            remote.port,
            remote.address
          );
        } else if (isPlayerRequest(message)) {
          socket.send(
            buildPlayerReply([
              { name: '', durationS: 120.5 },
              { name: '', durationS: 30 }
            ]),
            remote.port,
            remote.address
          );
        }
      });
      await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
      port = socket.address().port;
    });

    afterAll(() => {
      socket.close();
    });

    it('answers info and player queries', async () => {
      const info = await queryInfo('127.0.0.1', port);
      expect(info.name).toBe('Guild rig');
      expect(info.players).toBe(2);
      expect(info.gameVersion).toBe('1.0.7');
      expect(info.port).toBe(2456);
      const players = await queryPlayers('127.0.0.1', port);
      expect(players).toHaveLength(2);
      expect(players[0]?.durationS).toBeCloseTo(120.5);
    });

    it('times out when nothing answers', async () => {
      const silent = createSocket('udp4');
      await new Promise<void>((resolve) => silent.bind(0, '127.0.0.1', resolve));
      const silentPort = silent.address().port;
      await expect(queryInfo('127.0.0.1', silentPort, 300)).rejects.toThrow('timed out');
      silent.close();
    });
  });

  it('queries the live guild server when it is reachable', async () => {
    const host = process.env.STEAM_QUERY_HOST;
    const port = Number(process.env.STEAM_QUERY_PORT);
    if (!host || !port) return;
    let info;
    try {
      info = await queryInfo(host, port, 4000);
    } catch {
      return;
    }
    expect(info.maxPlayers).toBe(10);
    expect(info.serverType).toBe('d');
    expect(info.gameVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
