import { describe, expect, it } from "vitest";
import { createGestureGate } from "./gestures";

describe("hand gestures", () => {
  const palm = { categoryName: "Open_Palm", score: 0.91 };
  const victory = { categoryName: "Victory", score: 0.87 };

  it("fires once per held gesture and re-arms after the hand is lowered", () => {
    const recognize = createGestureGate();
    expect([0, 120, 240, 360].map((time) => recognize(palm, time))).toEqual([null, null, null, "pause"]);
    expect([480, 600, 720, 840, 960].map((time) => recognize(palm, time))).toEqual(Array(5).fill(null));
    for (const time of [1080, 1200, 1320]) expect(recognize(undefined, time)).toBeNull();
    expect([1440, 1560, 1680, 1800].map((time) => recognize(palm, time))).toEqual([null, null, null, "pause"]);
  });

  it("ignores low-confidence detections and requires fresh consecutive frames for a different pose", () => {
    const recognize = createGestureGate();
    for (const time of [0, 120, 240, 360]) expect(recognize({ ...victory, score: 0.5 }, time)).toBeNull();
    expect(recognize(victory, 480)).toBeNull();
    expect([1000, 1120, 1240, 1360].map((time) => recognize(victory, time))).toEqual([null, null, null, "back"]);
  });
});
