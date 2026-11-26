// VideoLayers' exercise controls: a small bar over the video to mark where an exercise starts, jump back to that
// moment, and slow the video down. Shown while the pointer is over the player or the video is paused. Plain DOM, so it
// costs nothing on pages without it. Gestures and buttons share the exercise's start and playback speed.
import { createGestureButton } from "./gestureButton";

export const SPEEDS = [0.25, 0.5, 0.75, 1];

// What the buttons do, apart from the bar, so they can be tested and driven by other inputs
export function createExercise(video: HTMLVideoElement) {
  let start: number | null = null;
  return {
    get start() {
      return start;
    },
    markStart() {
      start = video.currentTime;
      return start;
    },
    // Back to the marked start and playing; without a mark, to the beginning
    backToStart() {
      video.currentTime = start ?? 0;
      if (video.paused) video.play().catch(() => {});
    },
    setSpeed(rate: number) {
      video.playbackRate = rate;
    },
    // Another video in the same element (YouTube swaps them) starts with no mark
    forget() {
      start = null;
    },
  };
}

const formatTime = (seconds: number) => {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
};

let mounted: { bar: HTMLElement; cleanup: () => void } | null = null;

export function mountExercise(
  video: HTMLVideoElement,
  container: HTMLElement,
  { exercise: showExercise = true, gestures = false } = {},
) {
  unmountExercise();
  const exercise = createExercise(video);

  const bar = document.createElement("div");
  bar.className = "vl-exercise";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Exercise");

  const button = (label: string, onClick: () => void, className = "") => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = `vl-exercise__button ${className}`.trim();
    element.textContent = label;
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    return element;
  };

  const mark = button("Mark start", () => {
    exercise.markStart();
    render();
  });
  const back = button("↺ Back to start", () => exercise.backToStart(), "vl-exercise__button--main");
  const speeds = document.createElement("div");
  speeds.className = "vl-exercise__speeds";
  speeds.setAttribute("role", "group");
  speeds.setAttribute("aria-label", "Speed");
  const speedButtons = SPEEDS.map((rate) => {
    const element = button(`${rate}×`, () => {
      exercise.setSpeed(rate);
      render();
    });
    speeds.append(element);
    return { rate, element };
  });
  if (showExercise) bar.append(mark, back, speeds);
  const gestureButton = gestures
    ? createGestureButton(
        (action) => {
          if (!video.isConnected || document.hidden) return;
          switch (action) {
            case "pause":
              video.pause();
              break;
            case "play":
              video.play().catch(() => {});
              break;
            case "back":
              exercise.backToStart();
              break;
            case "slow":
              exercise.setSpeed(video.playbackRate === 0.5 ? 1 : 0.5);
              break;
          }
          render();
        },
        (active) => bar.toggleAttribute("data-gestures-active", active),
      )
    : null;
  if (gestureButton) bar.append(gestureButton.button);

  const render = () => {
    mark.textContent = exercise.start === null ? "Mark start" : `Start ${formatTime(exercise.start)}`;
    mark.title = exercise.start === null ? "Remember this moment as the exercise's start" : "Mark a new start here";
    back.title = exercise.start === null ? "Back to the beginning" : `Back to ${formatTime(exercise.start)}`;
    for (const { rate, element } of speedButtons) {
      element.setAttribute("aria-pressed", String(video.playbackRate === rate));
    }
    bar.toggleAttribute("data-paused", video.paused);
  };

  // Clicks on the bar shouldn't reach the player under it (YouTube pauses on a click)
  const swallow = (event: Event) => event.stopPropagation();
  bar.addEventListener("mousedown", swallow);
  bar.addEventListener("dblclick", swallow);

  const onNewVideo = () => {
    exercise.forget();
    gestureButton?.stop();
    render();
  };
  video.addEventListener("ratechange", render);
  video.addEventListener("play", render);
  video.addEventListener("pause", render);
  video.addEventListener("emptied", onNewVideo);

  const generic = container.classList.contains("vl-video-overlay");
  const onPointerMove = (event: PointerEvent) => {
    const rect = video.getBoundingClientRect();
    bar.toggleAttribute(
      "data-hovered",
      event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom,
    );
  };
  if (generic) document.addEventListener("pointermove", onPointerMove, { passive: true });
  const position = container.style.position;
  const adjustPosition = getComputedStyle(container).position === "static";
  if (adjustPosition) container.style.position = "relative";
  container.append(bar);
  render();

  mounted = {
    bar,
    cleanup: () => {
      video.removeEventListener("ratechange", render);
      video.removeEventListener("play", render);
      video.removeEventListener("pause", render);
      video.removeEventListener("emptied", onNewVideo);
      document.removeEventListener("pointermove", onPointerMove);
      if (adjustPosition && container.style.position === "relative") container.style.position = position;
      gestureButton?.dispose();
      bar.remove();
    },
  };
  return exercise;
}

export function unmountExercise() {
  mounted?.cleanup();
  mounted = null;
}
