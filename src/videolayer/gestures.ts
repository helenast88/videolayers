export const OPEN_GESTURES = "videolayers:openGestures";
export const GESTURE_PAGE = "src/pages/gestures/index.html";
export const GESTURE_PORT = "videolayers:gestures:";

const actions = {
  Open_Palm: "pause",
  Thumb_Up: "play",
  Victory: "back",
  Closed_Fist: "slow",
} as const;

export type GestureAction = (typeof actions)[keyof typeof actions];
export const isGestureAction = (value: unknown): value is GestureAction =>
  Object.values(actions).some((action) => action === value);

type Prediction = { categoryName: string; score: number } | undefined;

// A held pose fires once. Require a stable, confident prediction, then a brief release or a different pose.
export function createGestureGate() {
  let candidate: GestureAction | null = null;
  let held: GestureAction | null = null;
  let since = 0;
  let samples = 0;
  let lastSample = -Infinity;
  let lastAction = -Infinity;

  return (prediction: Prediction, time: number): GestureAction | null => {
    const action =
      prediction && prediction.score >= 0.75 && Object.hasOwn(actions, prediction.categoryName)
        ? actions[prediction.categoryName as keyof typeof actions]
        : null;
    if (candidate !== action || time - lastSample > 350) {
      candidate = action;
      since = time;
      samples = 0;
    }
    lastSample = time;
    samples++;
    if (action === null) {
      if (time - since >= 220) held = null;
      return null;
    }
    if (action === held || samples < 4 || time - since < 350 || time - lastAction < 650) return null;
    held = action;
    lastAction = time;
    return action;
  };
}
