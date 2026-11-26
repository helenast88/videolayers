import type { GestureRecognizer } from "@mediapipe/tasks-vision";
import { createGestureGate, GESTURE_PORT, type GestureAction } from "@src/videolayer/gestures";
import "./style.css";

const preview = document.querySelector("video")!;
const button = document.querySelector<HTMLButtonElement>("#camera")!;
const status = document.querySelector("#status")!;
const labels: Record<GestureAction, string> = {
  pause: "Pause",
  play: "Play",
  back: "Back to start",
  slow: "Switch speed",
};

let camera: MediaStream | null = null;
let recognizer: GestureRecognizer | null = null;
let streamTimer: number | undefined;
let generation = 0;
let running = false;
let port: chrome.runtime.Port | null = null;

function stop(message: string) {
  generation++;
  running = false;
  clearInterval(streamTimer);
  camera?.getTracks().forEach((track) => track.stop());
  camera = null;
  preview.srcObject = null;
  preview.hidden = true;
  recognizer?.close();
  recognizer = null;
  button.textContent = "Start camera";
  button.disabled = !port;
  status.textContent = message;
  port?.postMessage({ type: "state", active: false });
}

async function start() {
  const request = ++generation;
  running = true;
  button.textContent = "Stop camera";
  status.textContent = "Waiting for camera access…";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 24 } },
    });
    if (request !== generation) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    camera = stream;
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener(
        "ended",
        () => {
          if (request === generation) stop("The camera disconnected.");
        },
        { once: true },
      );
    });
    status.textContent = "Loading gesture recognition…";
    preview.srcObject = stream;
    preview.hidden = false;
    await preview.play();
    const { FilesetResolver, GestureRecognizer } = await import("@mediapipe/tasks-vision");
    const assets = chrome.runtime.getURL("assets/mediapipe");
    const fileset = await FilesetResolver.forVisionTasks(assets);
    if (request !== generation) return;
    const model = await GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: assets + "/gesture_recognizer.task" },
      runningMode: "VIDEO",
      numHands: 1,
    });
    if (request !== generation) {
      model.close();
      return;
    }

    recognizer = model;
    port?.postMessage({ type: "state", active: true });
    status.textContent = "Camera on. Show a gesture.";
    const recognize = createGestureGate();
    let previousFrame = -1;
    streamTimer = window.setInterval(() => {
      if (preview.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || preview.currentTime === previousFrame) return;
      previousFrame = preview.currentTime;
      const now = performance.now();
      try {
        const prediction = model.recognizeForVideo(preview, now).gestures[0]?.[0];
        const action = recognize(prediction, now);
        if (action) {
          status.textContent = `Recognized: ${labels[action]}`;
          port?.postMessage({ type: "gesture", action });
        }
      } catch {
        stop("Gesture recognition stopped. Start the camera to try again.");
      }
    }, 100);
  } catch (error) {
    if (request !== generation) return;
    const reason = error instanceof DOMException ? error.name : "";
    if (reason === "NotAllowedError") stop("Camera access was denied. Allow it in Chrome and try again.");
    else if (reason === "NotFoundError" || reason === "NotReadableError")
      stop("The camera is unavailable. Check that it is connected and free.");
    else stop("Could not start gesture recognition. Try again.");
  }
}

const target = new URLSearchParams(location.hash.slice(1));
const tabId = Number(target.get("tab"));
const frameId = Number(target.get("frame"));
const documentId = target.get("document");
const token = target.get("token");
if (tabId > 0 && Number.isInteger(tabId) && Number.isInteger(frameId) && token && /^[a-f0-9]{32}$/.test(token)) {
  port = chrome.tabs.connect(tabId, {
    ...(documentId ? { documentId } : { frameId }),
    name: GESTURE_PORT + token,
  });
  port.onMessage.addListener((message) => {
    if (message.type !== "ready") return;
    button.disabled = false;
    status.textContent = "Camera off.";
  });
  port.onDisconnect.addListener(() => {
    void chrome.runtime.lastError;
    port = null;
    stop("Video disconnected. Open Gestures on the player to reconnect.");
    window.close();
  });
} else {
  stop("Open Gestures on a video to use the camera.");
}

button.addEventListener("click", () => {
  if (running) stop("Camera off.");
  else if (port) void start();
});

window.addEventListener("pagehide", () => {
  port = null;
  stop("");
});
