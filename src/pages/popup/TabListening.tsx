import { useEffect, useState } from "react";
import { TAB_LISTEN_EXPLAINED, TAB_LISTEN_LABEL } from "@src/utils/aiSubs/status";
import { InfoNote } from "@src/videolayer/InfoNote";
import { TAB_LISTENING_ASKED, TAB_LISTENING_CHANGED, type TTabListening } from "@src/videolayer/tabListening";

// VideoLayers: lets the speech model hear the whole tab, shown only while it's needed: AI subtitles are on and the
// video's audio is protected (or the tab is being heard already). The page says which (src/videolayer/init.ts).
// Chrome lets the tab be captured only after a click on the extension, which is why this lives here and not on the
// page (src/pages/background/audio.ts).
const TabListening = () => {
  const [tabId, setTabId] = useState<number | null>(null);
  const [state, setState] = useState<TTabListening | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chrome.offscreen) return;
    chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(async ([tab]) => {
      if (tab?.id === undefined) return;
      setTabId(tab.id);
      try {
        setState(await chrome.tabs.sendMessage(tab.id, { type: TAB_LISTENING_ASKED }));
      } catch {
        // No VideoLayers on this page: nothing to hear
      }
    });
  }, []);

  if (tabId === null || !state?.needed) return null;

  const toggle = async () => {
    setError(null);
    if (state.listening) {
      await chrome.runtime.sendMessage({ type: "stopTabCapture", tabId });
    } else {
      const granted = await chrome.permissions.request({ permissions: ["tabCapture"] });
      if (!granted) return;
      const answer = await chrome.runtime.sendMessage({ type: "startTabCapture", tabId });
      if (answer?.error) {
        setError(`Can't listen: ${answer.error}`);
        return;
      }
    }
    const listening = !state.listening;
    setState({ ...state, listening });
    chrome.tabs.sendMessage(tabId, { type: TAB_LISTENING_CHANGED, listening }).catch(() => {});
  };

  return (
    <section className="vl-packs vl-listen" aria-labelledby="vl-listen-title">
      <div className="vl-listen-head">
        <span id="vl-listen-title" className="vl-pack-name">
          {state.listening ? "Making subtitles from the tab's sound" : TAB_LISTEN_LABEL}
        </span>
        <p className="vl-pack-description vl-listen-why">
          {state.listening
            ? "The tab's sound plays through VideoLayers while it listens."
            : "This video's sound is protected, so the AI subtitles can't hear it."}
        </p>
        <InfoNote label="What this does">{TAB_LISTEN_EXPLAINED}</InfoNote>
      </div>
      <button type="button" className="vl-button vl-button-primary" onClick={toggle}>
        {state.listening ? "Stop" : "Listen to this tab"}
      </button>
      {error && (
        <p className="vl-pack-description" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};

export default TabListening;
