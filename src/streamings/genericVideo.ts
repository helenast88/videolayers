import { esRenderSetings } from "@src/models/settings";
import { esSubsChanged } from "@src/models/subs";
import type { Captions, TSubsTrack } from "@src/models/types";
import { getCurrentVideoFx } from "@src/models/videos";
import { languageFromTrack } from "@src/utils/languages";
import { watchMainVideo } from "@src/videolayer/mainVideo";
import { createVideoOverlay } from "@src/videolayer/videoOverlay";
import type Service from "./service";

const TRACK_PREFIX = "html5:";
const isCaption = (track: TextTrack) => track.kind === "subtitles" || track.kind === "captions";

function readCues(track: TextTrack): Captions {
  return [...(track.cues ?? [])]
    .map((cue: VTTCue) => ({
      start: cue.startTime * 1000,
      end: cue.endTime * 1000,
      text: (cue.text ?? "").replace(/<[^>]*>/g, "").trim(),
    }))
    .filter(({ text }) => text);
}

class GenericVideo implements Service {
  readonly name = "generic";
  private video: HTMLVideoElement | null = null;
  private overlay: ReturnType<typeof createVideoOverlay> | null = null;
  private settingsSlot: HTMLElement | null = null;
  private videoEvents: AbortController | null = null;
  private primaryTrack: TextTrack | null = null;
  private readonly loadedTracks = new Set<TextTrack>();
  private useSiteCaptions = false;
  private primaryLabel = "";
  private cueCount = 0;

  init() {
    if (this.overlay) return;
    this.overlay = createVideoOverlay();
    this.settingsSlot = document.createElement("span");
    this.settingsSlot.hidden = true;
    this.overlay.element.append(this.settingsSlot);
    watchMainVideo((video) => {
      this.overlay?.update(video);
      if (this.video !== video) this.attachVideo(video);
    });
  }

  getVideo() {
    return this.video;
  }

  setSiteCaptions(enabled: boolean) {
    if (this.useSiteCaptions === enabled) return;
    this.useSiteCaptions = enabled;
    if (!enabled) this.restoreTracks();
    this.updateCaptions();
  }

  getSettingsButtonContainer() {
    return this.settingsSlot!;
  }

  getSettingsContentContainer() {
    return this.getSubsContainer();
  }

  getSubsContainer() {
    return this.overlay!.element;
  }

  isOnFlight() {
    return false;
  }

  async getSubs(label: string): Promise<Captions> {
    const video = this.video;
    const track = label.startsWith(TRACK_PREFIX) ? video?.textTracks[Number(label.slice(TRACK_PREFIX.length))] : null;
    if (!video || !track || !isCaption(track)) return [];
    this.loadTrack(track);
    const source = [...video.querySelectorAll("track")].find((element) => element.track === track);
    if (source && source.readyState < HTMLTrackElement.LOADED) {
      // A disabled WebVTT track loads when read, including a second-language track picked in settings.
      await new Promise<void>((resolve) => {
        const controller = new AbortController();
        const finish = () => {
          clearTimeout(timer);
          controller.abort();
          resolve();
        };
        const timer = setTimeout(finish, 5000);
        const options = { signal: controller.signal };
        source.addEventListener("load", finish, options);
        source.addEventListener("error", finish, options);
        this.videoEvents?.signal.addEventListener("abort", finish, options);
      });
    }
    return this.video === video ? readCues(track) : [];
  }

  async getSubsTracks(): Promise<TSubsTrack[]> {
    return [...(this.video?.textTracks ?? [])].flatMap((track, index) => {
      if (track === this.primaryTrack || !isCaption(track)) return [];
      const language = languageFromTrack(track.language, track.label);
      return language
        ? [
            {
              label: TRACK_PREFIX + index,
              language,
              name: track.label,
              kind: track.kind === "captions" ? "cc" : "subtitles",
            },
          ]
        : [];
    });
  }

  private loadTrack(track: TextTrack) {
    if (track.mode !== "disabled") return;
    this.loadedTracks.add(track);
    track.mode = "hidden";
  }

  private restoreTracks() {
    this.loadedTracks.forEach((track) => {
      if (track.mode === "hidden") track.mode = "disabled";
    });
    this.loadedTracks.clear();
  }

  private updateCaptions = (event?: Event) => {
    if (!this.video) return;
    const all = [...this.video.textTracks];
    const tracks = all.filter(isCaption);
    const main =
      tracks.find((track) => track.mode === "showing") ??
      tracks.find((track) => track.mode === "hidden" && !this.loadedTracks.has(track)) ??
      (this.useSiteCaptions ? tracks[0] : undefined);
    if (main) this.loadTrack(main);
    const label = main ? TRACK_PREFIX + all.indexOf(main) : "";
    const count = main?.cues?.length ?? 0;
    if (
      main !== this.primaryTrack ||
      label !== this.primaryLabel ||
      count !== this.cueCount ||
      event?.type === "load"
    ) {
      this.primaryTrack = main ?? null;
      this.primaryLabel = label;
      this.cueCount = count;
      this.video.classList.toggle("vl-caption-source", !!main && count > 0);
      esSubsChanged(label);
    }
  };

  private attachVideo(video: HTMLVideoElement | null) {
    this.videoEvents?.abort();
    this.video?.classList.remove("vl-caption-source");
    this.restoreTracks();
    this.video = video;
    this.primaryTrack = null;
    this.primaryLabel = "";
    this.cueCount = 0;
    getCurrentVideoFx();
    if (!video) {
      esSubsChanged("");
      return;
    }
    this.videoEvents = new AbortController();
    const options = { signal: this.videoEvents.signal };
    video.addEventListener("load", this.updateCaptions, { ...options, capture: true });
    video.addEventListener("loadedmetadata", this.updateCaptions, options);
    for (const name of ["change", "addtrack", "removetrack"]) {
      video.textTracks.addEventListener(name, this.updateCaptions, options);
    }
    esRenderSetings();
    // Set up the subtitle UI for dropped files and AI subtitles even if there is no native track.
    esSubsChanged("");
    this.updateCaptions();
  }
}

export default GenericVideo;
