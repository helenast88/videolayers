# VideoLayers — plan

Status: v2 after review (fresh Claude session; Codex unavailable), 2026-11-26. Owner decisions: harness DECISIONS.md, entries of 2026-11-26.

## Idea in one line
A free, open-source Chrome extension: on a video on any site you pick a **pack** — a named set of features
with its own look — such as "Language", "YouTube", "Sport on YouTube". You choose a pack, not single features.

## Base
Fork of EasySubs (Nitrino/easysubs, MIT, v3.1.3, commit 6b12125). Kept as is in `src/`; builds and its
726 unit tests pass unchanged. EasySubs already has: YouTube / Netflix / Coursera / Jellyfin / … adapters
(`src/streamings`), the second subtitle line (dual subtitles), previous / next / repeat line, a transcript
sidebar, subtitles found online or dropped as a file, on-device AI subtitles and translation. Users can
already grant extra sites (`optional_host_permissions` + `webext-dynamic-content-scripts`), but an unknown
site falls to `ServiceStub`, which throws: there is no "any `<video>`" adapter.

## What we add (new code lives in `src/videolayer/`, upstream files touched as little as possible)
1. **Packs are data**, not code: `{ id, name, description, skin, settings (EasySubs preset), inputs }`.
   Built-in packs ship in the code; the chosen pack is remembered per site (host) under our own storage key.
   - EasySubs settings are global and persisted (`src/utils/withPersist.ts`: one `chrome.storage.local` key per
     store, no sync between tabs). So a pack's values are kept per host by us and re-applied on every load,
     **after** EasySubs has restored its own values (rehydration is async, an early apply gets overwritten):
     apply when `$streaming` becomes a real service.
   - A manual change in the EasySubs panel on a site is saved as that site's override on top of the pack.
   - Language pack drives existing events: `enableToggleChanged`, `secondarySubsChanged`,
     `moveBySubsEnabledChanged`, `progressBarEnabledChanged`, `$transcriptOpen` (we add our own `.on`).
   - On YouTube the main subtitles exist only once YouTube's player requests `/api/timedtext`, so the pack turns
     YouTube's own captions on through the page script, not through settings.
2. **One command bus** instead of a module registry (EasySubs can't be unmounted, only switched off):
   play/pause, seek, previous/next/repeat line, second line, transcript — mapped onto existing Effector events
   (`moveKeyPressed`, …). Keyboard, skin, gestures and voice are input sources on the bus; they never fake key
   presses (`src/utils/keyboardHandler.ts` grabs arrows in the capture phase).
3. **Generic video adapter** (`src/streamings/genericVideo.ts`, modelled on `jellyfin.ts`: textTracks → captions),
   matched only on hosts the user granted in the popup and not in `MATCHES` (detection gives up after 5 tries,
   a wrong match would stick). It fires `esRenderSetings()` itself and inits once. New optional
   `Service.getVideo()` returns the largest playing `<video>` (also in open shadow roots); `getCurrentVideoFx`
   (`src/models/videos/index.ts`) uses it instead of the first `video` in the document. `getVideoKey()` for
   remembered files. Dropped files, found and AI subtitles then work as they do now.
   - Reach: `all_frames` for embedded players in iframes; the popup today injects only the first content script
     into the top frame (`src/pages/popup/Popup.tsx`); `webext-dynamic-content-scripts` drops `world: "MAIN"`, so
     `mseTap` (AI subtitles from buffered audio) needs its own registration on granted sites.
4. **Skin**: one simple control bar in our own overlay over the video (ResizeObserver; the video's parent is
   often unpositioned or clips). Fullscreen through `src/hooks/usePortalTarget.ts`; when a site fullscreens the
   `<video>` itself, we fullscreen our container instead. The skin owns two slots that hiding the site's
   controls would remove: the EasySubs settings button (today inside `.ytp-right-controls`) and its progress
   bar (today stacked at `bottom: 0`). Themes are CSS tokens.
5. **Popup**: packs for the current site, current one marked; "Use on this site" asks for the permission.

## Upstream hooks (about 8 small edits; everything else in `src/videolayer/`)
`src/utils/getCurrentService.ts` (generic before stub), `src/streamings/service.ts` (`getVideo?`),
`src/models/videos/index.ts` (use it), `src/pages/content/index.ts` (one import of `@src/videolayer/init`),
`src/pages/content/style.scss` (our styles), `src/pages/popup/Popup.tsx`, `manifest.js` (name, `all_frames`),
`playground/src/main.ts` (switch to the generic adapter for e2e). Maybe offer upstream a PR for the skin slot.

## Milestones
- M0 — rename to the working name, keep `LICENSE` with Nitrino's copyright and add ours, README credit.
- M1 — packs as data + per-host override layer applied after rehydration + command bus + pack picker in the popup;
  one pack "Language" on YouTube, captions switched on through the page script.
- M2 — generic `<video>` adapter with `Service.getVideo`, gated match, `all_frames`, playground switch:
  "Language" works on a plain page with a `<track>` or a dropped file, also inside an iframe.
- M3 — the simple skin on YouTube and on the generic adapter, fullscreen included, with the settings-button and
  progress-bar slots.
- M4 — the second pack ("YouTube" or "Sport") once the owner picks its features.
- Later — `gestures`, `voice`, more skins; publish on GitHub (owner's step).

## Checks per milestone
Unit tests (vitest) for packs and the registry; the playground (`pnpm playground`) and its Playwright e2e for
the language module on the generic adapter; a manual run on YouTube with the unpacked build. Media in tests is
muted.

## Risks (top 3 from the review)
1. Global settings vs per-site packs: values bleed across sites and tabs; startup race with rehydration.
2. "Any site" reach: iframes, shadow DOM, ad pre-rolls, a video swapped on single-page sites, a `<video>` that
   is itself fullscreen, page CSP.
3. Hiding a site's controls removes YouTube's CC button and the EasySubs settings button, and breaks when the
   site changes its markup.
Also: the fork drifts from an active upstream (keep hooks small, merge often); EasySubs' many host permissions
and its onboarding page to strip before publishing.
