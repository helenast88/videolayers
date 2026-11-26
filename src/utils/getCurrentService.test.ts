import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentService } from "./getCurrentService";

const setTitle = (title: string) => {
  document.title = title;
};

describe("getCurrentService", () => {
  beforeEach(() => {
    // Netflix and Jellyfin watch their players with intervals
    vi.useFakeTimers();
    document.head.replaceChildren();
    document.documentElement.removeAttribute("id");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("detects YouTube by its host and marks the page for its styles", () => {
    vi.stubGlobal("location", new URL("https://www.youtube.com/watch?v=test"));

    expect(getCurrentService().name).toBe("youtube");
    expect(document.documentElement.id).toBe("youtube");
  });

  it("marks the new YouTube player design", () => {
    vi.stubGlobal("location", new URL("https://www.youtube-nocookie.com/embed/test"));
    document.body.append(Object.assign(document.createElement("div"), { className: "ytp-delhi-modern" }));

    getCurrentService();

    expect(document.body.classList).toContain("es-youtube-delphi");
  });

  it("detects Netflix by its host", () => {
    vi.stubGlobal("location", new URL("https://www.netflix.com/watch/test"));

    expect(getCurrentService().name).toBe("netflix");
    expect(document.documentElement.id).toBe("netflix");
  });

  it("detects Coursera by its host", () => {
    vi.stubGlobal("location", new URL("https://www.coursera.org/learn/test"));

    expect(getCurrentService().name).toBe("coursera");
  });

  it("detects KinoPub by its meta tag", () => {
    setTitle("Фильм");
    document.head.innerHTML = '<meta content="Кинопаб">';

    expect(getCurrentService().name).toBe("kinopub");
  });

  it("detects Jellyfin by its application name", () => {
    setTitle("Jellyfin");
    document.head.innerHTML = '<meta name="application-name" content="Jellyfin">';

    expect(getCurrentService().name).toBe("jellyfin");
  });

  it("uses the generic player on other sites, even if they mention a supported platform", () => {
    setTitle("Why I left YouTube");

    expect(getCurrentService().name).toBe("generic");
  });
});
