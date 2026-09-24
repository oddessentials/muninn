const jsonModules = import.meta.glob('/fixtures/api/**/*.json', {
  eager: true,
  import: 'default'
}) as Record<string, unknown>;

const imageModules = import.meta.glob('/fixtures/api/**/*.png', {
  eager: true,
  import: 'default',
  query: '?inline'
}) as Record<string, string>;

const prefix = '/fixtures/api/';

function nameOf(modulePath: string, extension: string): string {
  return modulePath.slice(prefix.length, modulePath.length - extension.length);
}

const documents = new Map<string, unknown>();
for (const [modulePath, document] of Object.entries(jsonModules)) {
  documents.set(nameOf(modulePath, '.json'), document);
}

const images = new Map<string, Uint8Array<ArrayBuffer>>();
for (const [modulePath, dataUrl] of Object.entries(imageModules)) {
  const comma = dataUrl.indexOf(',');
  const bytes = Buffer.from(dataUrl.slice(comma + 1), 'base64');
  images.set(nameOf(modulePath, '.png'), new Uint8Array(bytes));
}

export function getFixture(name: string): unknown {
  return documents.get(name);
}

export function hasFixture(name: string): boolean {
  return documents.has(name) || images.has(name);
}

export function getFixtureImage(name: string): Uint8Array<ArrayBuffer> | undefined {
  return images.get(name);
}

export function fixtureNames(): string[] {
  return [...documents.keys(), ...images.keys()].sort();
}

export function cloneFixture<T>(name: string): T | undefined {
  const document = documents.get(name);
  return document === undefined ? undefined : (structuredClone(document) as T);
}
