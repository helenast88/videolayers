import { expect, it, vi } from "vitest";
import { findMainVideo } from "./mainVideo";

it("chooses a large paused video in an open shadow root over a playing preview", () => {
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  const video = document.createElement("video");
  const preview = document.createElement("video");
  const hidden = document.createElement("video");
  vi.spyOn(video, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 20, 720, 405));
  vi.spyOn(preview, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 440, 160, 90));
  vi.spyOn(preview, "paused", "get").mockReturnValue(false);
  vi.spyOn(hidden, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 960, 540));
  hidden.style.visibility = "hidden";
  shadow.append(video);
  document.body.append(host, preview, hidden);

  expect(findMainVideo()).toBe(video);
  host.remove();
  expect(findMainVideo()).toBe(preview);
});
