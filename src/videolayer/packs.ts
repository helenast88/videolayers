// Packs: named sets of features for what a video is watched for. A pack is data: the EasySubs settings it sets
// when it's picked for a site. Settings a pack leaves out stay as the user has them. Built-in packs are here; the
// user's own packs are kept in storage (customPacks.ts) and use the same features.

export type TPackSettings = {
  // EasySubs on or off on the page
  enabled?: boolean;
  // The second line: in the translation language, or off
  secondLine?: "translation" | "off";
  // Arrow keys jump to the previous or next line and repeat the current one
  moveBySubs?: boolean;
  // The video pauses at the end of every line
  autoPause?: boolean;
  // The lines' strip under the player
  progressBar?: boolean;
  // Turn on the site's own captions, which the main line is made of (YouTube's CC button)
  siteCaptions?: boolean;
  // VideoLayers' exercise controls over the video: mark where an exercise starts, jump back, slow down (exercise.ts)
  exercise?: boolean;
};

// A pack's label colour. The popup's WebEmber look is monochrome and doesn't show it; it's kept for the player's
// pack button and a coloured look later.
export const PACK_COLORS = ["blue", "green", "purple", "orange", "pink", "teal", "yellow"] as const;
export type TPackColor = (typeof PACK_COLORS)[number];

export type TPack = {
  id: string;
  name: string;
  description: string;
  settings: TPackSettings;
  color?: TPackColor;
  // Made by the user: can be changed and deleted
  custom?: boolean;
};

// The features a pack can switch, as the pack editor lists them: EasySubs settings, and VideoLayers' own exercise
// controls.
export type TFeatureKey = "secondLine" | "moveBySubs" | "autoPause" | "progressBar" | "siteCaptions" | "exercise";

export const FEATURES: { key: TFeatureKey; name: string; description: string }[] = [
  { key: "secondLine", name: "Second line", description: "The subtitles in your language under the original" },
  { key: "moveBySubs", name: "Phrase keys", description: "← → jump to the previous or next phrase, ↓ repeats it" },
  { key: "autoPause", name: "Pause after each phrase", description: "Time to repeat it before the next one" },
  { key: "progressBar", name: "Phrase strip", description: "The phrases as marks under the player" },
  { key: "siteCaptions", name: "Site's captions on", description: "Turns on YouTube's CC, the source of the lines" },
  {
    key: "exercise",
    name: "Exercise controls",
    description: "Mark where an exercise starts, jump back to it, slow down to 0.25×",
  },
];

export const PACKS: TPack[] = [
  {
    id: "language",
    name: "Language",
    description: "Two subtitle lines, jump to the previous or next phrase, repeat a phrase",
    settings: { enabled: true, moveBySubs: true, secondLine: "translation", siteCaptions: true },
    color: "blue",
  },
  {
    id: "sport",
    name: "Sport",
    description: "Mark where an exercise starts, jump back to it, slow down to 0.25×",
    // Subtitles stay as the user has them
    settings: { exercise: true },
    color: "green",
  },
];

// Whether a pack has a feature on, and a pack's settings from the features ticked in the editor. A user's pack
// names every feature, on or off, so switching between packs always lands on the same player.
export const isFeatureOn = (settings: TPackSettings, key: TFeatureKey) =>
  key === "secondLine" ? settings.secondLine === "translation" : settings[key] === true;

export const settingsFromFeatures = (on: TFeatureKey[]): TPackSettings => ({
  enabled: true,
  secondLine: on.includes("secondLine") ? "translation" : "off",
  moveBySubs: on.includes("moveBySubs"),
  autoPause: on.includes("autoPause"),
  progressBar: on.includes("progressBar"),
  siteCaptions: on.includes("siteCaptions"),
  exercise: on.includes("exercise"),
});

// What a pack does, in words, from its features
export const describeFeatures = (settings: TPackSettings) =>
  FEATURES.filter(({ key }) => isFeatureOn(settings, key))
    .map(({ name }) => name)
    .join(", ") || "Nothing on";

export const findPack = (id: string | null | undefined, packs: TPack[] = PACKS): TPack | undefined =>
  packs.find((pack) => pack.id === id);

// The colour for a new pack: the first one no pack has yet, then round again
export const nextPackColor = (packs: TPack[]): TPackColor => {
  const used = new Set(packs.map((pack) => pack.color));
  return PACK_COLORS.find((color) => !used.has(color)) ?? PACK_COLORS[packs.length % PACK_COLORS.length];
};
