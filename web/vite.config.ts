import { readFileSync } from 'node:fs';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as {
  version: string;
};

export const kit = {
  adapter: adapter({ out: 'build' }),
  env: {
    dir: '..'
  }
};

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(kit)],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version)
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
