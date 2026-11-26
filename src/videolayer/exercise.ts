// VideoLayers' exercise controls: a small bar over the video to mark where an exercise starts, jump back to that
// moment, and slow the video down. Shown while the pointer is over the player or the video is paused. Plain DOM, so it
// costs nothing on pages without it; gestures (the camera) will drive the same actions later.

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

export function mountExercise(video: HTMLVideoElement, container: HTMLElement) {
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
  bar.append(mark, back, speeds);

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
    render();
  };
  video.addEventListener("ratechange", render);
  video.addEventListener("play", render);
  video.addEventListener("pause", render);
  video.addEventListener("emptied", onNewVideo);

  if (getComputedStyle(container).position === "static") container.style.position = "relative";
  container.append(bar);
  render();

  mounted = {
    bar,
    cleanup: () => {
      video.removeEventListener("ratechange", render);
      video.removeEventListener("play", render);
      video.removeEventListener("pause", render);
      video.removeEventListener("emptied", onNewVideo);
      bar.remove();
    },
  };
  return exercise;
}

export function unmountExercise() {
  mounted?.cleanup();
  mounted = null;
}
