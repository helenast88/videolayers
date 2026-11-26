const PREFIX = "videolayers-site-";
const LEGACY_PREFIX = "webext-dynamic-content-script-";

// Follow grants when they change and update registered files when a new build changes their filenames.
async function syncSiteScripts() {
  const manifest = chrome.runtime.getManifest();
  const { origins = [] } = await chrome.permissions.getAll();
  // getManifest()'s type still describes the MV2 content-script fields.
  const definitions = (manifest.content_scripts ?? []) as Array<
    NonNullable<chrome.runtime.Manifest["content_scripts"]>[number] & { world?: chrome.scripting.ExecutionWorld }
  >;
  const requiredPatterns = [...(manifest.host_permissions ?? []), ...definitions.flatMap((script) => script.matches)];
  const required = new Set(requiredPatterns.flatMap((match) => [match, match.replace(/(\/\/[^/]+)\/.*/, "$1/*")]));
  // The KinoPub bridge is scoped to the mirrors in its manifest entry.
  const generalDefinitions = definitions.filter((script) => !script.js?.includes("assets/js/kinopub.js"));
  const wanted = origins
    .filter((origin) => !required.has(origin))
    .flatMap((origin) =>
      generalDefinitions.map((script, index): chrome.scripting.RegisteredContentScript => ({
        id: PREFIX + index + "-" + encodeURIComponent(origin),
        matches: [origin],
        excludeMatches: script.matches,
        js: script.js,
        css: script.css,
        allFrames: script.all_frames,
        runAt: script.run_at ?? "document_idle",
        world: script.world ?? "ISOLATED",
      })),
    );

  const registered = await chrome.scripting.getRegisteredContentScripts();
  const wantedIds = new Set(wanted.map(({ id }) => id));
  const stale = registered.filter(
    ({ id }) => id.startsWith(LEGACY_PREFIX) || (id.startsWith(PREFIX) && !wantedIds.has(id)),
  );
  if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale.map(({ id }) => id) });
  const registeredIds = new Set(registered.map(({ id }) => id));
  const updates = wanted.filter(({ id }) => registeredIds.has(id));
  const additions = wanted.filter(({ id }) => !registeredIds.has(id));
  if (updates.length) await chrome.scripting.updateContentScripts(updates);
  if (additions.length) await chrome.scripting.registerContentScripts(additions);
}

export function watchSiteAccess() {
  // The playground has no scripting API.
  if (!chrome.scripting?.getRegisteredContentScripts) return;
  let pending = Promise.resolve();
  const sync = () => {
    pending = pending.then(syncSiteScripts).catch((error) => console.error("VideoLayers site access", error));
  };
  chrome.runtime.onInstalled.addListener(sync);
  chrome.runtime.onStartup.addListener(sync);
  chrome.permissions.onAdded.addListener(sync);
  chrome.permissions.onRemoved.addListener(sync);
}
