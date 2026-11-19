import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, __APP_VERSION__: 'readonly' }
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser
      }
    }
  },
  {
    rules: {
      'svelte/no-navigation-without-resolve': 'off'
    }
  },
  {
    files: ['tests/e2e/**'],
    ignores: ['tests/e2e/hydrated.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              message: 'Import from ./hydrated.ts so every page load waits for hydration.'
            }
          ]
        }
      ]
    }
  },
  {
    ignores: ['build/', '.svelte-kit/', 'src/lib/api/types.ts', 'drizzle/meta/']
  }
);
