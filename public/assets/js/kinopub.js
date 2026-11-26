// Read the same track that Vidstack is displaying, including when captions were on before the bridge loaded.
(() => {
  if (window.videoLayersKinoBridge) return;
  window.videoLayersKinoBridge = true;

  let previousPlayer;
  let previousTrack;
  let previousSignature;
  let captionsRequested = false;
  let autoEnabledFor;

  const labelOf = (track) => track?.label || track?.language || "";
  const isSubtitle = (track) => track.kind === "subtitles" || track.kind === "captions";

  function publish(force = false) {
    const player = document.querySelector("media-player") ?? document.querySelector("#player");
    if (!player) return;
    const video = player.querySelector("video");
    const state = player.state;
    const src = state?.source?.src ?? video?.currentSrc;
    const source = typeof src === "string" ? src : "";
    const tracks = Array.from(state?.textTracks ?? player.textTracks?.toArray?.() ?? video?.textTracks ?? []).filter(
      isSubtitle,
    );
    let active = state?.textTrack ?? tracks.find((track) => track.mode === "showing");
    if (captionsRequested && (player !== previousPlayer || autoEnabledFor !== source) && tracks.length) {
      autoEnabledFor = source;
      if (!active) {
        active = tracks.find((track) => !/forced|форс/i.test(labelOf(track))) ?? tracks[0];
        active.mode = "showing";
      }
    }

    const cues = active?.cues;
    const signature = JSON.stringify([
      source,
      labelOf(active),
      cues?.length,
      cues?.[0]?.startTime,
      cues?.[cues.length - 1]?.endTime,
      tracks.map(labelOf),
    ]);
    if (!force && player === previousPlayer && active === previousTrack && signature === previousSignature) return;
    previousPlayer = player;
    previousTrack = active;
    previousSignature = signature;
    const message = {
      source,
      label: labelOf(active),
      tracks: tracks.map((track) => ({
        label: labelOf(track),
        language: track.language,
        kind: track.kind,
        src: track.src,
      })),
      cues: Array.from(cues ?? [], (cue) => ({
        start: cue.startTime * 1000,
        end: cue.endTime * 1000,
        text: typeof cue.text === "string" ? cue.text.replace(/<[^>]*>/g, "").trim() : "",
      })).filter((cue) => cue.text),
    };
    // A string can cross the isolated content-script boundary in Chrome and Firefox.
    window.dispatchEvent(new CustomEvent("videolayersKinoState", { detail: JSON.stringify(message) }));
  }

  window.addEventListener("videolayersKinoSnapshot", () => publish(true));
  window.addEventListener("videolayersKinoCaptions", (event) => {
    captionsRequested = event.detail === "on";
    autoEnabledFor = undefined;
    publish(true);
  });
  window.setInterval(publish, 500);
  publish();
  window.dispatchEvent(new Event("videolayersKinoReady"));
})();
