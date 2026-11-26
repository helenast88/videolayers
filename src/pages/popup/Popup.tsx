import { useEffect, useState } from "react";
import { sitePermission } from "@src/videolayer/sitePacks";
import SitePacks from "./SitePacks";
import Credits from "./Credits";
import TabListening from "./TabListening";

const Popup = () => {
  const [tab, setTab] = useState<chrome.tabs.Tab>();
  const [accessMessage, setAccessMessage] = useState("");
  useEffect(() => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([active]) => setTab(active));
  }, []);
  const origin = sitePermission(tab?.url);
  const handleRequestPermissions = async () => {
    if (!origin || tab?.id === undefined) return;
    const tabId = tab.id;
    setAccessMessage("");
    try {
      if (!(await chrome.permissions.request({ origins: [origin] }))) {
        setAccessMessage("Allow site access to use VideoLayers here.");
        return;
      }
    } catch {
      setAccessMessage("Chrome does not allow VideoLayers on this page.");
      return;
    }

    // Inject into the current tab without reloading, so SPA players
    // don't lose their playback state. The background registers scripts for future page loads.
    const scripts = chrome.runtime.getManifest().content_scripts ?? [];
    const [contentScript] = scripts;
    const kinoBridge = scripts.find(
      (script) => script.matches?.includes(origin) && script.js?.includes("assets/js/kinopub.js"),
    );
    const inject = async (allFrames: boolean) => {
      const target = { tabId, allFrames };
      if (contentScript?.css?.length) await chrome.scripting.insertCSS({ target, files: contentScript.css });
      if (contentScript?.js?.length) await chrome.scripting.executeScript({ target, files: contentScript.js });
      if (kinoBridge?.js?.length) {
        await chrome.scripting.executeScript({ target, files: kinoBridge.js, world: "MAIN" });
      }
    };
    try {
      await inject(true);
    } catch {
      try {
        // Chrome may reject an all-frame injection when a third-party frame lacks site access.
        await inject(false);
        setAccessMessage("Site enabled. Reload the page if its embedded player is missing.");
      } catch {
        setAccessMessage("Site access was granted. Reload this page to start VideoLayers.");
      }
      return;
    }
    window.close();
  };

  // VideoLayer: no links to EasySubs' site, FAQ or support; what it's made with is on the Credits page
  const [creditsOpen, setCreditsOpen] = useState(false);
  if (creditsOpen) {
    return (
      <div className="content">
        <div className="header">VideoLayers</div>
        <Credits onBack={() => setCreditsOpen(false)} />
      </div>
    );
  }

  return (
    <div className="content">
      <div className="header">VideoLayers</div>
      <SitePacks />
      <TabListening />
      <button type="button" className="vl-enable" onClick={handleRequestPermissions} disabled={!origin}>
        Enable on this site
      </button>
      {accessMessage && <p role="status">{accessMessage}</p>}
      <menu>
        <li onClick={() => setCreditsOpen(true)}>
          <a className="vl-credits-link">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20.5s-7.5-4.6-9.4-9.3C1.4 8.2 3.3 4.5 6.9 4.5c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.6 0 5.5 3.7 4.3 6.7-1.9 4.7-9.4 9.3-9.4 9.3Z" />
            </svg>
            Credits
          </a>
        </li>
      </menu>
    </div>
  );
};

export default Popup;
