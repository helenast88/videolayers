import { CONTENT_SITE_REQUEST, siteOf } from "@src/videolayer/sitePacks";

async function start() {
  // The extension popup saves packs under the tab's host, including when its player lives in an iframe.
  const host: string | null =
    window === window.top
      ? siteOf(location.href)
      : await chrome.runtime
          .sendMessage({ type: CONTENT_SITE_REQUEST })
          .then((reply) => reply?.site)
          .catch(() => null);
  if (!host) return;
  await import("@src/models/init");
  const [, { initPacks }] = await Promise.all([import("./main"), import("@src/videolayer/init")]);
  initPacks(host);
}

void start();
