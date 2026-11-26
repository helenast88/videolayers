// The same selection is used for subtitles and playback controls. A small autoplaying preview should not
// take control away from a larger player that the viewer just paused.
export function findMainVideo(): HTMLVideoElement | null {
  let main: HTMLVideoElement | null = null;
  let largestArea = 0;
  const fullscreen = document.fullscreenElement;

  function scan(root: Document | ShadowRoot) {
    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) scan(element.shadowRoot);
      if (!(element instanceof HTMLVideoElement)) continue;
      if (fullscreen && !fullscreen.contains(element) && (element.getRootNode() as ShadowRoot).host !== fullscreen) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      const width = Math.min(rect.right, innerWidth) - Math.max(rect.left, 0);
      const height = Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0);
      if (width <= 0 || height <= 0 || getComputedStyle(element).visibility !== "visible") continue;
      const area = width * height;
      if (area > largestArea || (area === largestArea && main?.paused && !element.paused)) {
        main = element;
        largestArea = area;
      }
    }
  }

  scan(document);
  return main;
}

// Media events update immediately. A low-frequency check also finds players added later by a SPA or shadow root.
export function watchMainVideo(update: (video: HTMLVideoElement | null) => void) {
  const refresh = () => {
    if (!document.hidden) update(findMainVideo());
  };
  const events = ["play", "loadedmetadata", "fullscreenchange", "visibilitychange"] as const;
  events.forEach((name) => document.addEventListener(name, refresh, true));
  const timer = window.setInterval(refresh, 1000);
  refresh();
  return () => {
    clearInterval(timer);
    events.forEach((name) => document.removeEventListener(name, refresh, true));
  };
}
