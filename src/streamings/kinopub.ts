import { Parser } from "m3u8-parser";
import { parse } from "subtitle";

import { esSubsChanged } from "@src/models/subs";
import { esRenderSetings } from "@src/models/settings";
import type { Captions, TSubsTrack } from "@src/models/types";
import { getCurrentVideoFx } from "@src/models/videos";
import { languageFromTrack } from "@src/utils/languages";
import Service from "./service";

type TSubtitlesGroup = Record<string, { language?: string; forced?: boolean; uri: string }>;
type TPlayerState = {
  source: string;
  label: string;
  tracks: { label: string; language?: string; kind: string; src?: string }[];
  cues: Captions;
};

const isKinoHost = () => ["kinopub.net", "kino.watch", "kinopub.cc"].includes(location.hostname);
const findPlayer = () =>
  document.querySelector<HTMLElement>("media-player") ?? document.querySelector<HTMLElement>("#player");

class KinoPub implements Service {
  name = "kinopub";

  private videoPlaylistUrl: string | undefined;
  private state: TPlayerState | null = null;
  private slot: HTMLElement | null = null;
  private requestedCaptions = false;

  public init(): void {
    window.addEventListener("videolayersKinoReady", this.requestCaptions);
    window.addEventListener("videolayersKinoState", this.handlePlayerState);
    window.dispatchEvent(new Event("videolayersKinoSnapshot"));
    // The mirrors ship the bridge as a MAIN-world content script. Custom KinoPub instances use the same bridge.
    if (!isKinoHost()) this.injectScript();
  }

  public async getSubs(label: string) {
    if (!label) return parse("");
    if (label === this.state?.label && this.state.cues.length) return this.state.cues;
    const trackSrc = this.state?.tracks.find((track) => track.label === label)?.src;
    if (trackSrc && !/\.m3u8(?:[?#]|$)/i.test(trackSrc)) {
      const response = await fetch(new URL(trackSrc, location.href));
      if (response.ok) return parse(await response.text());
    }
    if (!this.videoPlaylistUrl) return parse("");

    const subsSegments = await this.getSubtitlesGroup();
    if (!subsSegments[label]?.uri) return parse("");
    const uri = new URL(subsSegments[label].uri, this.videoPlaylistUrl);
    const subsSegmentsResp = await fetch(uri);
    const subsSegmentsData = await subsSegmentsResp.text();

    const subsSegmentsParser = new Parser();
    subsSegmentsParser.push(subsSegmentsData);
    subsSegmentsParser.end();

    const segment = subsSegmentsParser.manifest.segments[0]?.uri;
    if (!segment) return parse(subsSegmentsData);
    const segmentUri = new URL(segment, uri).href;
    const subPath = segmentUri.match(/.*\/hls\/(.*)\/seg.*/)?.[1];
    if (!subPath) return parse("");
    const subUri = `${new URL(segmentUri).origin}/pd/${subPath}`;

    const subsResp = await fetch(subUri);
    const subsData = await subsResp.text();

    const subs = parse(subsData);
    if (subs.length && label === this.state?.label) document.body.classList.add("vl-kinopub-captions");
    return subs;
  }

  // The subtitles of the HLS manifest; their names are the labels the player shows
  public async getSubsTracks(): Promise<TSubsTrack[]> {
    const available = (this.state?.tracks ?? []).flatMap(({ label, language: code, kind }): TSubsTrack[] => {
      const language = languageFromTrack(code, label);
      if (!language) return [];
      const trackKind = /forced|форс/i.test(label) ? "forced" : kind === "captions" ? "cc" : "subtitles";
      return [{ label, language, kind: trackKind, name: label }];
    });
    if (available.length || !this.videoPlaylistUrl) return available;
    const group = await this.getSubtitlesGroup();
    return Object.entries(group).flatMap(([name, entry]): TSubsTrack[] => {
      const language = languageFromTrack(entry.language, name);
      if (!language) return [];
      const kind = entry.forced || /forced|форс/i.test(name) ? "forced" : "subtitles";
      return [{ label: name, language, kind, name }];
    });
  }

  private async getSubtitlesGroup(): Promise<TSubtitlesGroup> {
    const resp = await fetch(this.videoPlaylistUrl);
    const parser = new Parser();
    parser.push(await resp.text());
    parser.end();
    return Object.assign({}, ...Object.values(parser.manifest.mediaGroups?.SUBTITLES ?? {})) as TSubtitlesGroup;
  }

  public getSubsContainer() {
    // Try Vidstack player first, then fallback to old #player selector
    const selector = findPlayer();
    if (selector === null) throw new Error("Subtitles container not found");
    return selector as HTMLElement;
  }

  public getVideo() {
    const player = findPlayer();
    return player?.querySelector("video") ?? player?.shadowRoot?.querySelector("video") ?? null;
  }

  public getSettingsButtonContainer() {
    const player = this.getSubsContainer();
    const gear = player.querySelector<HTMLElement>(".control-button.btn-settings");
    if (gear) return gear;
    if (!this.slot?.isConnected) {
      this.slot = document.createElement("span");
      this.slot.className = "vl-kinopub-slot";
      this.slot.hidden = true;
      player.append(this.slot);
    }
    return this.slot;
  }

  public getSettingsContentContainer() {
    return this.getSubsContainer();
  }

  public isOnFlight() {
    return false;
  }

  setSiteCaptions(enabled: boolean) {
    if (enabled === this.requestedCaptions) return;
    this.requestedCaptions = enabled;
    this.requestCaptions();
  }

  private requestCaptions = () => {
    window.dispatchEvent(new CustomEvent("videolayersKinoCaptions", { detail: this.requestedCaptions ? "on" : "off" }));
  };

  private handlePlayerState = (event: Event) => {
    const player = findPlayer();
    if (!player) return;
    let next: TPlayerState;
    try {
      next = JSON.parse((event as CustomEvent<string>).detail);
      if (
        typeof next.source !== "string" ||
        typeof next.label !== "string" ||
        !Array.isArray(next.cues) ||
        !Array.isArray(next.tracks)
      )
        return;
    } catch {
      return;
    }
    const previous = this.state;
    const needsSettings = !player.querySelector(".es-settings");
    this.state = next;
    this.videoPlaylistUrl = /\.m3u8(?:[?#]|$)/i.test(next.source)
      ? new URL(next.source, location.href).href
      : undefined;
    if (needsSettings) esRenderSetings();
    else if (previous?.source !== next.source) getCurrentVideoFx();
    if (!needsSettings && JSON.stringify(next) === JSON.stringify(previous)) return;
    document.body.classList.toggle("vl-kinopub-captions", next.cues.length > 0);
    esSubsChanged(next.label);
  };

  private injectScript() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("assets/js/kinopub.js");
    script.type = "module";
    document.head.prepend(script);
  }
}

export default KinoPub;
