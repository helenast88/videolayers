// Which pack is picked on which site, kept by host under one key. Shared by the popup (writes) and the content
// script (reads, and follows changes).

export const SITE_PACKS_KEY = "videolayer:sitePacks";

export type TSitePacks = Record<string, string>;

// The host a pack is remembered for; null for pages that aren't web pages (chrome://, files)
export const siteOf = (url: string | undefined): string | null => {
  if (!url) return null;
  try {
    const { protocol, host } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? host : null;
  } catch {
    return null;
  }
};

export const readSitePacks = async (): Promise<TSitePacks> => {
  const result = await chrome.storage.local.get(SITE_PACKS_KEY);
  const value = result[SITE_PACKS_KEY];
  return value && typeof value === "object" ? (value as TSitePacks) : {};
};

export const readSitePack = async (site: string): Promise<string | null> => (await readSitePacks())[site] ?? null;

// null takes the site's pack away: EasySubs stays as the user has it
export const writeSitePack = async (site: string, packId: string | null): Promise<void> => {
  const packs = { ...(await readSitePacks()) };
  if (packId) {
    packs[site] = packId;
  } else {
    delete packs[site];
  }
  await chrome.storage.local.set({ [SITE_PACKS_KEY]: packs });
};

export const onSitePacksChanged = (listener: (packs: TSitePacks) => void) => {
  // The playground's chrome shim has no onChanged (playground/src/chromeShim.ts)
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area !== "local" || !(SITE_PACKS_KEY in changes)) return;
    listener((changes[SITE_PACKS_KEY].newValue as TSitePacks) ?? {});
  });
};
