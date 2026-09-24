export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

export interface WebManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: ManifestIcon[];
}

export const surfaceColor = '#121116';
export const shortNameLength = 12;

export function shortName(siteName: string): string {
  const name = siteName.trim();
  let short = '';
  for (const word of name.split(/\s+/)) {
    const next = short ? `${short} ${word}` : word;
    if (next.length > shortNameLength) break;
    short = next;
  }
  return short || name.slice(0, shortNameLength);
}

export function webManifest(siteName: string): WebManifest {
  return {
    name: siteName,
    short_name: shortName(siteName),
    description: "Live log of the guild's Valheim server: who is online, who died, what fell.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: surfaceColor,
    theme_color: surfaceColor,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
}
