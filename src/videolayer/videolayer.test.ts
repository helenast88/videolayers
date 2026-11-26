import { describe, expect, it } from "vitest";
import "@src/models/init";
import {
  $autoPause,
  $enabled,
  $moveBySubsEnabled,
  $progressBarEnabled,
  $secondarySubs,
  enableToggleChanged,
} from "@src/models/settings";
import { applyPackSettings, turnOnYoutubeCaptions } from "./apply";
import { combinePacks, describeFeatures, FEATURES, findPack, isFeatureOn, PACKS, settingsFromFeatures } from "./packs";
import { deleteCustomPack, readAllPacks, readCustomPacks, saveCustomPack } from "./customPacks";
import { readSitePack, readSitePacks, siteOf, SITE_PACKS_KEY, writeSitePacks } from "./sitePacks";

describe("packs", () => {
  it("have unique ids and are found by them", () => {
    expect(new Set(PACKS.map((pack) => pack.id)).size).toBe(PACKS.length);
    expect(findPack("language")?.name).toBe("Language");
    expect(findPack("nope")).toBeUndefined();
    expect(findPack(null)).toBeUndefined();
  });
});

describe("site packs", () => {
  it("remember a pack by the page's host", () => {
    expect(siteOf("https://www.youtube.com/watch?v=1")).toBe("www.youtube.com");
    expect(siteOf("http://localhost:5180/x")).toBe("localhost:5180");
    expect(siteOf("chrome://extensions")).toBeNull();
    expect(siteOf(undefined)).toBeNull();
    expect(siteOf("not a url")).toBeNull();
  });

  it("are saved per site, several at once, and taken away with an empty list", async () => {
    await writeSitePacks("www.youtube.com", ["language", "sport", "language"]);
    await writeSitePacks("vimeo.com", ["language"]);
    expect(await readSitePack("www.youtube.com")).toEqual(["language", "sport"]);

    await writeSitePacks("www.youtube.com", []);
    expect(await readSitePack("www.youtube.com")).toEqual([]);
    expect(await readSitePacks()).toEqual({ "vimeo.com": ["language"] });
  });

  it("read a single pack saved before several were possible", async () => {
    await chrome.storage.local.set({ [SITE_PACKS_KEY]: { "www.youtube.com": "language", "x.com": 5 } });
    expect(await readSitePacks()).toEqual({ "www.youtube.com": ["language"] });
  });

  it("read as none when nothing or something odd is stored", async () => {
    expect(await readSitePacks()).toEqual({});
    await chrome.storage.local.set({ [SITE_PACKS_KEY]: "broken" });
    expect(await readSitePacks()).toEqual({});
  });
});

describe("applying the Language pack", () => {
  it("turns EasySubs, line navigation and the second line in the translation language on", async () => {
    enableToggleChanged(false);
    await Promise.resolve();
    expect($enabled.getState()).toBe(false);

    applyPackSettings(findPack("language")!);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect($enabled.getState()).toBe(true);
    expect($moveBySubsEnabled.getState()).toBe(true);
    expect($secondarySubs.getState()).toEqual({ language: "same" });
  });
});

describe("YouTube captions", () => {
  const button = (attrs: Record<string, string> = {}) => {
    const element = document.createElement("button");
    element.className = "ytp-subtitles-button";
    element.setAttribute("aria-pressed", "false");
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
    document.body.append(element);
    return element;
  };

  it("are turned on with YouTube's CC button", async () => {
    const cc = button();
    let clicks = 0;
    cc.addEventListener("click", () => clicks++);
    expect(await turnOnYoutubeCaptions()).toBe(true);
    expect(clicks).toBe(1);
  });

  it("are left alone when they're already on", async () => {
    const cc = button({ "aria-pressed": "true" });
    let clicks = 0;
    cc.addEventListener("click", () => clicks++);
    expect(await turnOnYoutubeCaptions()).toBe(true);
    expect(clicks).toBe(0);
  });

  it("can't be turned on for a video without them", async () => {
    button({ "aria-disabled": "true" });
    expect(await turnOnYoutubeCaptions()).toBe(false);
  });

  it("wait for the player's button to appear", async () => {
    setTimeout(() => button(), 400);
    expect(await turnOnYoutubeCaptions(document, 2000)).toBe(true);
  });

  it("give up when the button never comes", async () => {
    expect(await turnOnYoutubeCaptions(document, 500)).toBe(false);
  });
});

describe("the user's own packs", () => {
  it("name every feature, on or off, and read them back the same", () => {
    const settings = settingsFromFeatures(["secondLine", "autoPause"]);
    expect(settings).toEqual({
      enabled: true,
      secondLine: "translation",
      moveBySubs: false,
      autoPause: true,
      progressBar: false,
      siteCaptions: false,
      exercise: false,
      gestures: false,
    });
    expect(FEATURES.filter(({ key }) => isFeatureOn(settings, key)).map(({ key }) => key)).toEqual([
      "secondLine",
      "autoPause",
    ]);
    expect(describeFeatures(settings)).toBe("Second line, Pause after each phrase");
    expect(describeFeatures(settingsFromFeatures([]))).toBe("Nothing on");
  });

  it("are made, changed and deleted, after the built-in ones", async () => {
    const made = await saveCustomPack({ name: "  Sport  ", features: ["progressBar"] });
    expect(made).toMatchObject({ name: "Sport", custom: true, settings: { progressBar: true } });
    expect((await readAllPacks()).map((pack) => pack.id)).toEqual([...PACKS.map((pack) => pack.id), made.id]);

    await saveCustomPack({ id: made.id, name: "", features: ["moveBySubs"] });
    const [changed] = await readCustomPacks();
    expect(changed).toMatchObject({ id: made.id, name: "My pack", settings: { moveBySubs: true, progressBar: false } });

    expect(changed.color).toBe(made.color);

    await deleteCustomPack(made.id);
    expect(await readCustomPacks()).toEqual([]);
  });

  it("get a colour no pack has yet", async () => {
    const first = await saveCustomPack({ name: "A", features: [] });
    const second = await saveCustomPack({ name: "B", features: [] });
    expect(findPack("language")?.color).toBe("blue");
    expect(findPack("sport")?.color).toBe("green");
    expect([first.color, second.color]).toEqual(["purple", "orange"]);
  });

  it("include built-in packs the user changed, which reset to how they ship", async () => {
    await saveCustomPack({ id: "sport", name: "Gym", features: ["exercise", "progressBar"] });
    const all = await readAllPacks();
    const sport = findPack("sport", all)!;
    expect(sport).toMatchObject({ name: "Gym", edited: true, custom: false, color: "green" });
    expect(all.filter((pack) => pack.id === "sport")).toHaveLength(1);
    expect(all.map((pack) => pack.id).slice(0, 2)).toEqual(["language", "sport"]);

    await deleteCustomPack("sport");
    expect(findPack("sport", await readAllPacks())).toEqual(findPack("sport"));
  });

  it("are found by id among all packs", async () => {
    const made = await saveCustomPack({ name: "Mine", features: [] });
    expect(findPack(made.id, await readAllPacks())?.name).toBe("Mine");
    expect(findPack(made.id)).toBeUndefined();
  });

  it("switch the pause after each phrase and the phrase strip", async () => {
    applyPackSettings({ id: "x", name: "x", description: "", settings: settingsFromFeatures(["autoPause"]) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect($autoPause.getState()).toBe(true);
    expect($progressBarEnabled.getState()).toBe(false);
    expect($secondarySubs.getState()).toEqual({ language: "off" });

    applyPackSettings({ id: "y", name: "y", description: "", settings: settingsFromFeatures(["progressBar"]) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect($autoPause.getState()).toBe(false);
    expect($progressBarEnabled.getState()).toBe(true);
  });
});

describe("exercise controls", () => {
  it("mark a start, jump back to it and slow the video down", async () => {
    const { createVideo } = await import("@root/test/video");
    const { createExercise } = await import("./exercise");
    const video = createVideo({ currentTime: 42 });
    const exercise = createExercise(video);

    exercise.backToStart();
    expect(video.currentTime).toBe(0);

    video.currentTime = 42;
    expect(exercise.markStart()).toBe(42);
    video.currentTime = 70;
    exercise.backToStart();
    expect(video.currentTime).toBe(42);
    expect(video.play).toHaveBeenCalled();

    exercise.setSpeed(0.25);
    expect(video.playbackRate).toBe(0.25);

    exercise.forget();
    expect(exercise.start).toBeNull();
  });

  it("put a bar in the player and take it away", async () => {
    const { createVideo } = await import("@root/test/video");
    const { mountExercise, unmountExercise } = await import("./exercise");
    const container = document.createElement("div");
    const video = createVideo({ currentTime: 5 });
    container.append(video);
    document.body.append(container);

    mountExercise(video, container);
    const bar = container.querySelector(".vl-exercise")!;
    expect(bar).not.toBeNull();
    expect(bar.hasAttribute("data-paused")).toBe(true);

    const [mark, back] = bar.querySelectorAll("button");
    mark.click();
    expect(mark.textContent).toBe("Start 0:05");
    video.currentTime = 30;
    back.click();
    expect(video.currentTime).toBe(5);

    const half = [...bar.querySelectorAll("button")].find((button) => button.textContent === "0.5×")!;
    half.click();
    expect(video.playbackRate).toBe(0.5);

    unmountExercise();
    expect(container.querySelector(".vl-exercise")).toBeNull();
  });
});

describe("several packs on one site", () => {
  it("work as one: a feature is on when any pack turns it on", () => {
    const sportOnly = { id: "s", name: "S", description: "", settings: settingsFromFeatures(["exercise"]) };
    const combined = combinePacks([findPack("language")!, sportOnly])!;
    expect(combined.name).toBe("Language + S");
    expect(combined.settings).toMatchObject({
      enabled: true,
      secondLine: "translation",
      moveBySubs: true,
      siteCaptions: true,
      exercise: true,
      autoPause: false,
      progressBar: false,
    });
  });

  it("leave a single pack as it is, and none as none", () => {
    expect(combinePacks([findPack("sport")!])).toBe(findPack("sport"));
    expect(combinePacks([])).toBeUndefined();
  });
});
