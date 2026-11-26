import { useState } from "react";
import SitePacks from "./SitePacks";
import Credits from "./Credits";
import TabListening from "./TabListening";

async function getTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0];
}

const Popup = () => {
  const handleRequestPermissions = async () => {
    const tab = await getTab();
    const isGranted = await chrome.permissions.request({
      permissions: ["scripting", "storage", "activeTab"],
      origins: [tab.url],
    });
    if (!isGranted) return;

    // Inject into the current tab without reloading, so SPA players
    // (e.g. Jellyfin) don't lose their playback state. Future page loads
    // are handled automatically by webext-dynamic-content-scripts.
    const [contentScript] = chrome.runtime.getManifest().content_scripts ?? [];
    try {
      if (contentScript?.css?.length) {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: contentScript.css,
        });
      }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: contentScript.js,
      });
      window.close();
    } catch {
      // Fallback: reload if programmatic injection fails
      chrome.tabs.reload(tab.id);
    }
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
      <button type="button" className="vl-enable" onClick={handleRequestPermissions}>
        Enable on this site
      </button>
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
