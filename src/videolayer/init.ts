import { $streaming } from "@src/models/streamings";
import { $video } from "@src/models/videos";
import { applyPackSettings, turnOnYoutubeCaptions } from "./apply";
import { onCustomPacksChanged, readAllPacks } from "./customPacks";
import { mountExercise, unmountExercise } from "./exercise";
import { watchMainVideo } from "./mainVideo";
import { combinePacks, findPack, type TPack } from "./packs";
import { onSitePacksChanged, readSitePack } from "./sitePacks";
import { listenForTabListening } from "./tabListening";
import { createVideoOverlay } from "./videoOverlay";

export function initPacks(site: string) {
  let current: TPack | undefined;
  let started = false;
  let refreshId = 0;
  let watchingPlayer: (() => void) | undefined;
  let mountedVideo: HTMLVideoElement | null = null;
  let mountedContainer: HTMLElement | null = null;
  let overlay: ReturnType<typeof createVideoOverlay> | undefined;

  const placeControls = (video: HTMLVideoElement | null) => {
    let container: HTMLElement | null = null;
    if (video) {
      const service = $streaming.getState();
      try {
        const target = service.getSubsContainer();
        if (service.getVideo || (target && target !== document.body && target.contains(video))) container = target;
      } catch {
        // Some services render the player container after the video.
      }
      if (!container) {
        overlay ??= createVideoOverlay();
        overlay.update(video);
        container = overlay.element;
      }
    }
    if (container !== overlay?.element) overlay?.update(null);
    if (mountedVideo === video && mountedContainer === container) return;
    unmountExercise();
    mountedVideo = video;
    mountedContainer = container;
    if (video && container) mountExercise(video, container, current?.settings);
  };

  const restartControls = () => {
    watchingPlayer?.();
    watchingPlayer = undefined;
    placeControls(null);
    if (current?.settings.exercise || current?.settings.gestures) {
      watchingPlayer = $streaming.getState().getVideo ? $video.watch(placeControls) : watchMainVideo(placeControls);
    }
  };

  const updateCaptions = () => {
    const service = $streaming.getState();
    service.setSiteCaptions?.(!!current?.settings.siteCaptions);
    if (current?.settings.siteCaptions && service.name === "youtube") void turnOnYoutubeCaptions();
  };

  const refresh = async () => {
    const request = ++refreshId;
    const [all, selected] = await Promise.all([readAllPacks(), readSitePack(site)]);
    if (request !== refreshId) return;
    const pack = combinePacks(selected.map((id) => findPack(id, all)).filter((one): one is TPack => !!one));
    if (JSON.stringify(pack) === JSON.stringify(current)) return;
    const previous = current;
    current = pack;
    if (pack) applyPackSettings(pack);
    if (previous?.settings.siteCaptions !== pack?.settings.siteCaptions) updateCaptions();
    if (
      previous?.settings.exercise !== pack?.settings.exercise ||
      previous?.settings.gestures !== pack?.settings.gestures
    ) {
      restartControls();
    }
  };

  $streaming.watch((service) => {
    if (service.name === "stub") return;
    if (started) {
      if (current) {
        updateCaptions();
        restartControls();
      }
      return;
    }
    started = true;
    void refresh();
  });
  onSitePacksChanged(() => started && refresh());
  onCustomPacksChanged(() => started && refresh());
  document.addEventListener("yt-navigate-finish", updateCaptions);
  listenForTabListening();
}
