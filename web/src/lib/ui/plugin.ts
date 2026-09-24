export const pluginGuid = 'com.guildsite.telemetry';
export const configFileName = `${pluginGuid}.cfg`;
export const dllFileName = 'GuildTelemetry.dll';

export interface PluginConfigInput {
  origin: string;
  secret: string;
  mapEnabled: boolean;
}

export function ingestUrl(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/api/ingest`;
}

export function pluginConfig({ origin, secret, mapEnabled }: PluginConfigInput): string {
  const url = ingestUrl(origin);
  return [
    '[General]',
    '',
    `Url = ${url}`,
    `Secret = ${secret}`,
    'HeartbeatSeconds = 60',
    'FlushSeconds = 2',
    'BiomeSampleSeconds = 5',
    'PositionSampleSeconds = 20',
    'JournalMaxMB = 50',
    `AllowInsecureHttp = ${url.startsWith('http://')}`,
    'LogEvents = false',
    `MapEnabled = ${mapEnabled}`,
    'CatalogEnabled = true',
    ''
  ].join('\n');
}

export interface InstallGuide {
  id: string;
  label: string;
  steps: string[];
}

export const installGuides: InstallGuide[] = [
  {
    id: 'windows',
    label: 'Windows host',
    steps: [
      'Install BepInExPack_Valheim on the server: most hosts offer it as a one-click mod, otherwise copy the contents of its BepInExPack_Valheim folder into the server folder.',
      `Put ${dllFileName} in BepInEx/plugins/.`,
      `Put ${configFileName} in BepInEx/config/.`,
      'Restart the server.'
    ]
  },
  {
    id: 'linux',
    label: 'Linux host',
    steps: [
      'Copy the contents of the BepInExPack_Valheim folder into the server folder, run chmod u+x start_server_bepinex.sh and set your launch options in that script.',
      `Put ${dllFileName} in BepInEx/plugins/.`,
      `Put ${configFileName} in BepInEx/config/.`,
      'Start the server with ./start_server_bepinex.sh.'
    ]
  },
  {
    id: 'docker',
    label: 'Docker server',
    steps: [
      'Run ghcr.io/community-valheim-tools/valheim-server with BEPINEX=true.',
      `Put ${dllFileName} in /config/bepinex/plugins/.`,
      `Put ${configFileName} in /config/bepinex/.`,
      'Restart the container.'
    ]
  }
];
