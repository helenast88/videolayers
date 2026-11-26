import { describeFeatures, nextPackColor, PACKS, settingsFromFeatures, type TFeatureKey, type TPack } from "./packs";

// The user's own packs, kept in one list. The popup's editor writes them; the content script reads them and follows
// changes, so editing the pack a site uses changes the player there at once.
export const CUSTOM_PACKS_KEY = "videolayer:customPacks";

const isPack = (value: unknown): value is TPack =>
  !!value &&
  typeof value === "object" &&
  typeof (value as TPack).id === "string" &&
  typeof (value as TPack).name === "string" &&
  !!(value as TPack).settings &&
  typeof (value as TPack).settings === "object";

export const readCustomPacks = async (): Promise<TPack[]> => {
  const result = await chrome.storage.local.get(CUSTOM_PACKS_KEY);
  const value = result[CUSTOM_PACKS_KEY];
  return Array.isArray(value) ? value.filter(isPack).map((pack) => ({ ...pack, custom: true })) : [];
};

// Built-in packs first, then the user's
export const readAllPacks = async (): Promise<TPack[]> => [...PACKS, ...(await readCustomPacks())];

const writeCustomPacks = (packs: TPack[]) => chrome.storage.local.set({ [CUSTOM_PACKS_KEY]: packs });

// Makes a pack, or changes the one with this id. An empty name becomes "My pack".
export const saveCustomPack = async (draft: { id?: string; name: string; features: TFeatureKey[] }) => {
  const packs = await readCustomPacks();
  const settings = settingsFromFeatures(draft.features);
  const index = packs.findIndex((one) => one.id === draft.id);
  const pack: TPack = {
    id: draft.id ?? `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: draft.name.trim() || "My pack",
    description: describeFeatures(settings),
    settings,
    // A pack keeps its colour when it's changed
    color: packs[index]?.color ?? nextPackColor([...PACKS, ...packs]),
    custom: true,
  };
  if (index === -1) {
    packs.push(pack);
  } else {
    packs[index] = pack;
  }
  await writeCustomPacks(packs);
  return pack;
};

// Sites that used a deleted pack are left with no pack: EasySubs as the user set it up
export const deleteCustomPack = async (id: string) => {
  await writeCustomPacks((await readCustomPacks()).filter((pack) => pack.id !== id));
};

export const onCustomPacksChanged = (listener: () => void) => {
  // The playground's chrome shim has no onChanged (playground/src/chromeShim.ts)
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area === "local" && CUSTOM_PACKS_KEY in changes) listener();
  });
};
