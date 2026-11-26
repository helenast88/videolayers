# Contributing to VideoLayers

Thanks for wanting to help. Anything is welcome: an idea for a pack, a skin, a bug, a fix.

## Ideas and bugs

Open an [issue](https://github.com/helenast88/videolayers/issues). For a pack, say what you watch and what the player
should do for it (for example: "Cooking: pause when I raise my hand, show the recipe step").

## Code

1. Fork the repository and make a branch.
2. `npx pnpm@10 install`, then `npx pnpm@10 build` and load `dist/` at `chrome://extensions` (Developer mode → Load
   unpacked). `npx pnpm@10 playground` opens a local player that runs the extension's code with hot reload.
3. `npx pnpm@10 test` runs the unit tests; please add tests for what you change.
4. Open a pull request with what it changes for the person watching, and a screenshot if it shows.

## Where things are

- `src/videolayer/` — VideoLayers' own code: packs (`packs.ts`), the user's packs (`customPacks.ts`), which pack each
  site uses (`sitePacks.ts`), applying a pack (`apply.ts`, `init.ts`), the Sport bar (`exercise.ts`)
- `src/pages/popup/` — the toolbar window
- `src/assets/style/content/videolayers.scss` — VideoLayers' styles on the page
- Everything else comes from [EasySubs](https://github.com/Nitrino/easysubs): keep changes to its files small, so its
  updates can still be merged in. Its architecture notes are in `CLAUDE.md`.

## A new pack

A built-in pack is data in `PACKS` in `src/videolayer/packs.ts`: a name, a description and the features it turns on.
A new feature is a key in `TPackSettings` and `FEATURES`, applied in `apply.ts` (or, like the Sport bar, mounted
from `init.ts`).
