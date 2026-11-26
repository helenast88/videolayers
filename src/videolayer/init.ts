import { $streaming } from "@src/models/streamings";
import { applyPackSettings, turnOnYoutubeCaptions } from "./apply";
import { mountExercise, unmountExercise } from "./exercise";
import { onCustomPacksChanged, readAllPacks } from "./customPacks";
import { findPack, type TPack } from "./packs";
import { onSitePacksChanged, readSitePack } from "./sitePacks";
import { listenForTabListening } from "./tabListening";

// Applies the site's pack once the page's service is known. EasySubs restores its settings with an async
// chrome.storage read made when its models load; our reads are made later, so they answer after theirs and the
// pack isn't overwritten by the restored values.
const site = location.host;
let current: TPack | undefined;

// The video and the player box the exercise bar goes in: the service's subtitle container (inside the player, so it
// stays in fullscreen), else the video's parent. Waits for the player to appear, up to 10 s.
const findPlayer = async (): Promise<{ video: HTMLVideoElement; container: HTMLElement } | null> => {
  for (let tries = 0; tries < 20; tries++) {
    const video = document.querySelector("video");
    if (video) {
      let container: HTMLElement | null = null;
      try {
        container = $streaming.getState().getSubsContainer();
      } catch {
        container = null;
      }
      container ??= video.parentElement;
      if (container) return { video, container };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
};

const showExercise = async (on: boolean) => {
  unmountExercise();
  if (!on) return;
  const player = await findPlayer();
  if (player && current?.settings.exercise) mountExercise(player.video, player.container);
};

const apply = (pack: TPack | undefined) => {
  current = pack;
  showExercise(!!pack?.settings.exercise);
  if (!pack) return;
  applyPackSettings(pack);
  if (pack.settings.siteCaptions && $streaming.getState().name === "youtube") {
    turnOnYoutubeCaptions();
  }
};

// The site's pack as it is saved now; applied when it's another pack or the same pack changed in the editor
const refresh = async () => {
  const pack = findPack(await readSitePack(site), await readAllPacks());
  if (JSON.stringify(pack) !== JSON.stringify(current)) apply(pack);
};

let started = false;
$streaming.watch((streaming) => {
  if (started || streaming.name === "stub") return;
  started = true;
  refresh();
});

// A pack picked, taken away or edited in the popup applies without reloading the page
onSitePacksChanged(() => started && refresh());
onCustomPacksChanged(() => started && refresh());

// YouTube swaps videos without loading a page; the next one may start with captions off
document.addEventListener("yt-navigate-finish", () => {
  if (current?.settings.siteCaptions && $streaming.getState().name === "youtube") {
    turnOnYoutubeCaptions();
  }
});

// The toolbar window asks whether the tab's sound is needed for the AI subtitles (src/pages/popup/TabListening.tsx)
listenForTabListening();
