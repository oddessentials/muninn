import { describe, expect, it } from 'vitest';
import { configFileName, ingestUrl, installGuides, pluginConfig } from '$lib/ui/plugin';

function values(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split('\n')
      .filter((line) => line.includes(' = '))
      .map((line) => line.split(' = ') as [string, string])
  );
}

describe('the plugin config', () => {
  it('is named after the plugin guid', () => {
    expect(configFileName).toBe('com.guildsite.telemetry.cfg');
  });

  it('points the plugin at this site with its secret and keeps the other defaults', () => {
    const text = pluginConfig({
      origin: 'https://guild.example.com',
      secret: 's3cret',
      mapEnabled: true
    });
    expect(text.startsWith('[General]\n')).toBe(true);
    expect(values(text)).toEqual({
      Url: 'https://guild.example.com/api/ingest',
      Secret: 's3cret',
      HeartbeatSeconds: '60',
      FlushSeconds: '2',
      BiomeSampleSeconds: '5',
      PositionSampleSeconds: '20',
      JournalMaxMB: '50',
      AllowInsecureHttp: 'false',
      LogEvents: 'false',
      MapEnabled: 'true',
      CatalogEnabled: 'true'
    });
  });

  it('allows plain http only for an http site and follows the map switch', () => {
    const text = values(
      pluginConfig({ origin: 'http://192.168.1.20:3000/', secret: 'x', mapEnabled: false })
    );
    expect(text.Url).toBe('http://192.168.1.20:3000/api/ingest');
    expect(text.AllowInsecureHttp).toBe('true');
    expect(text.MapEnabled).toBe('false');
    expect(ingestUrl('https://guild.example.com')).toBe('https://guild.example.com/api/ingest');
  });

  it('explains the install for each kind of host', () => {
    expect(installGuides.map((guide) => guide.id)).toEqual(['windows', 'linux', 'docker']);
    for (const guide of installGuides) {
      expect(guide.steps.some((step) => step.includes('GuildTelemetry.dll'))).toBe(true);
      expect(guide.steps.some((step) => step.includes(configFileName))).toBe(true);
    }
  });
});
