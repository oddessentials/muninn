# Rules for this repository

1. No code comments: no `//`, `/* */`, `#` or `<!-- -->` comments, no doc comments, no commented-out code, no TODO or FIXME markers. `npm run comments:check` enforces this.
2. The only documents are `README.md`, the landing page in `site/`, the Thunderstore README in `thunderstore/` and `LICENSE`. Do not add others.
3. `web/openapi.yaml` is the API contract. `npm run api:types` regenerates `web/src/lib/api/types.ts` from it.
4. Facts about the game come from its code and assets, never from memory.
5. One version number: the root `package.json` `version`. The plugin build reads it.
6. Work on a branch and merge through a pull request once CI is green.
