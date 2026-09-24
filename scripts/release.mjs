import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const repository = 'oddessentials/muninn';
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const tag = `v${version}`;
const dll = join(root, 'plugin', 'out', 'GuildTelemetry.dll');
const zip = join(root, 'thunderstore', 'build', `oddessentials-Muninn-${version}.zip`);

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
  return (result.stdout ?? '').trim();
}

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`package.json version ${version} is not x.y.z`);
if (!process.env.GH_TOKEN) fail('set GH_TOKEN to a token that can create releases');
if (run('git', ['status', '--porcelain'], true) !== '') fail('commit or stash your changes first');
if (run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], true) !== 'main') fail('release from main');
run('git', ['fetch', '--quiet', 'origin', 'main']);
const head = run('git', ['rev-parse', 'HEAD'], true);
if (head !== run('git', ['rev-parse', 'origin/main'], true)) fail('main must match origin/main');
if (run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`], true) !== '') {
  fail(`${tag} already exists; bump the version in package.json first`);
}

console.log(`release: building GuildTelemetry.dll ${version}`);
run('dotnet', ['build', 'plugin/GuildTelemetry/GuildTelemetry.csproj', '-c', 'Release']);
if (!existsSync(dll)) fail(`${dll} was not built`);

console.log('release: packing the Thunderstore zip');
run('dotnet', ['tool', 'restore']);
run('dotnet', [
  'tcli',
  'build',
  '--config-path',
  'thunderstore/thunderstore.toml',
  '--package-version',
  version
]);
if (!existsSync(zip)) fail(`${zip} was not packed`);

console.log(`release: creating ${tag} on ${repository}`);
run('gh', [
  'release',
  'create',
  tag,
  '--repo',
  repository,
  '--target',
  head,
  '--title',
  `Muninn ${version}`,
  '--generate-notes',
  dll,
  zip
]);
console.log(
  `release: ${tag} is out. The release workflow now pushes the image, publishes to Thunderstore and updates the website: https://github.com/${repository}/actions/workflows/release.yml`
);
