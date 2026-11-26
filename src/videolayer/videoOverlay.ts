// The generic overlay follows the video without moving the site's player in the DOM. Keeping it outside the
// player's shadow root also lets the extension's content-script stylesheet style the controls.
export function createVideoOverlay() {
  const element = document.createElement("div");
  element.className = "vl-video-overlay";
  let video: HTMLVideoElement | null = null;
  let lastPosition = "";

  const position = () => {
    if (!video) return;
    const fullscreen = document.fullscreenElement;
    const parent =
      fullscreen instanceof HTMLElement && !(fullscreen instanceof HTMLMediaElement) ? fullscreen : document.body;
    if (element.parentElement !== parent) parent.append(element);
    const { left, top, width, height } = video.getBoundingClientRect();
    const coordinates = `${left},${top},${width},${height}`;
    if (coordinates === lastPosition) return;
    lastPosition = coordinates;
    Object.assign(element.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
  };

  const resize = new ResizeObserver(position);
  return {
    element,
    update(next: HTMLVideoElement | null) {
      if (next !== video) {
        resize.disconnect();
        window.removeEventListener("scroll", position, true);
        window.removeEventListener("resize", position);
        document.removeEventListener("fullscreenchange", position);
        video = next;
        if (!next) {
          element.remove();
          return;
        }
        resize.observe(next);
        window.addEventListener("scroll", position, true);
        window.addEventListener("resize", position);
        document.addEventListener("fullscreenchange", position);
      }
      position();
    },
  };
}
