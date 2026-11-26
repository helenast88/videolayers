import { GESTURE_PAGE, GESTURE_PORT, isGestureAction, OPEN_GESTURES, type GestureAction } from "./gestures";

export function createGestureButton(onAction: (action: GestureAction) => void, onActive: (active: boolean) => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vl-exercise__button";
  button.textContent = "Gestures";

  let session: string | null = null;
  let port: chrome.runtime.Port | null = null;
  let active = false;
  let openingTimer: number | undefined;
  const setActive = (next: boolean) => {
    active = next;
    button.textContent = active ? "Stop gestures" : session ? "Close gestures" : "Gestures";
    button.setAttribute("aria-pressed", String(active));
    onActive(active);
  };

  const stop = () => {
    clearTimeout(openingTimer);
    session = null;
    const previous = port;
    port = null;
    previous?.disconnect();
    setActive(false);
  };

  const connect = (incoming: chrome.runtime.Port) => {
    if (!session || incoming.name !== GESTURE_PORT + session || port) return;
    if (incoming.sender?.url?.split("#")[0] !== chrome.runtime.getURL(GESTURE_PAGE)) return;
    clearTimeout(openingTimer);
    port = incoming;
    incoming.onDisconnect.addListener(() => {
      if (port === incoming) stop();
    });
    incoming.onMessage.addListener((message) => {
      if (port !== incoming) return;
      if (message.type === "state") setActive(message.active === true);
      if (message.type === "gesture" && active && isGestureAction(message.action)) onAction(message.action);
    });
    incoming.postMessage({ type: "ready" });
  };
  chrome.runtime.onConnect?.addListener(connect);

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (session) {
      stop();
      return;
    }
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    session = token;
    button.removeAttribute("title");
    setActive(false);
    const unavailable = () => {
      if (session !== token) return;
      stop();
      button.textContent = "Retry gestures";
      button.title = "Could not open the gesture controls.";
    };
    openingTimer = window.setTimeout(unavailable, 10_000);
    chrome.runtime.sendMessage({ type: OPEN_GESTURES, token }).then((response) => {
      if (!response?.ok) unavailable();
    }, unavailable);
  });
  window.addEventListener("pagehide", stop);

  return {
    button,
    stop,
    dispose() {
      window.removeEventListener("pagehide", stop);
      chrome.runtime.onConnect?.removeListener(connect);
      stop();
    },
  };
}
