// Which packs are on for which site, kept by host under one key: a site can have several. Shared by the popup (writes)
// and the content script (reads, and follows changes).

export const SITE_PACKS_KEY = "videolayer:sitePacks";
export const CONTENT_SITE_REQUEST = "videolayers:contentSite";

export type TSitePacks = Record<string, string[]>;

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

export function sitePermission(url: string | undefined): string | null {
  if (!siteOf(url)) return null;
  const { protocol, hostname } = new URL(url!);
  return `${protocol}//${hostname}/*`;
}

// One pack per site was saved as a single id before several were possible
const asList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : typeof value === "string"
      ? [value]
      : [];

const normalize = (value: unknown): TSitePacks => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const packs: TSitePacks = {};
  for (const [site, ids] of Object.entries(value)) {
    const list = asList(ids);
    if (list.length) packs[site] = list;
  }
  return packs;
};

export const readSitePacks = async (): Promise<TSitePacks> => {
  const result = await chrome.storage.local.get(SITE_PACKS_KEY);
  return normalize(result[SITE_PACKS_KEY]);
};

export const readSitePack = async (site: string): Promise<string[]> => (await readSitePacks())[site] ?? [];

// An empty list takes the site's packs away: EasySubs stays as the user has it
export const writeSitePacks = async (site: string, packIds: string[]): Promise<void> => {
  const packs = { ...(await readSitePacks()) };
  const unique = [...new Set(packIds)];
  if (unique.length) {
    packs[site] = unique;
  } else {
    delete packs[site];
  }
  await chrome.storage.local.set({ [SITE_PACKS_KEY]: packs });
};

export const onSitePacksChanged = (listener: (packs: TSitePacks) => void) => {
  // The playground's chrome shim has no onChanged (playground/src/chromeShim.ts)
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area !== "local" || !(SITE_PACKS_KEY in changes)) return;
    listener(normalize(changes[SITE_PACKS_KEY].newValue));
  });
};
