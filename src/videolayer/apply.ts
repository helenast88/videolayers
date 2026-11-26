import {
  autoPauseChanged,
  enableToggleChanged,
  moveBySubsEnabledChanged,
  progressBarEnabledChanged,
  secondarySubsChanged,
  $autoPause,
  $enabled,
  $moveBySubsEnabled,
  $progressBarEnabled,
  $secondarySubs,
} from "@src/models/settings";
import type { TPack } from "./packs";

// Sets the EasySubs settings a pack names. Only what differs is changed, so picking the same pack again does nothing.
export function applyPackSettings(pack: TPack) {
  const { enabled, moveBySubs, secondLine, autoPause, progressBar } = pack.settings;
  if (enabled !== undefined && $enabled.getState() !== enabled) {
    enableToggleChanged(enabled);
  }
  if (moveBySubs !== undefined && $moveBySubsEnabled.getState() !== moveBySubs) {
    moveBySubsEnabledChanged(moveBySubs);
  }
  if (autoPause !== undefined && $autoPause.getState() !== autoPause) {
    autoPauseChanged(autoPause);
  }
  if (progressBar !== undefined && $progressBarEnabled.getState() !== progressBar) {
    progressBarEnabledChanged(progressBar);
  }
  if (secondLine !== undefined) {
    // "same": the translation language, whatever it is set to (src/utils/resolveSecondarySubs.ts)
    const language = secondLine === "translation" ? "same" : "off";
    if ($secondarySubs.getState().language !== language) {
      secondarySubsChanged({ language });
    }
  }
}

const CAPTIONS_BUTTON = ".ytp-subtitles-button";

// YouTube makes the main line only once its player loads captions, so they're turned on with its own CC button.
// Done once the button is there; a video without captions has it disabled, and then nothing is pressed.
export function turnOnYoutubeCaptions(root: ParentNode = document, timeoutMs = 10_000): Promise<boolean> {
  const press = () => {
    const button = root.querySelector<HTMLButtonElement>(CAPTIONS_BUTTON);
    if (!button) return null;
    if (button.getAttribute("aria-pressed") === "true") return true;
    if (button.disabled || button.getAttribute("aria-disabled") === "true") return false;
    button.click();
    return true;
  };
  return new Promise((resolve) => {
    const result = press();
    if (result !== null) return resolve(result);
    const started = Date.now();
    const timer = setInterval(() => {
      const later = press();
      if (later !== null || Date.now() - started > timeoutMs) {
        clearInterval(timer);
        resolve(later ?? false);
      }
    }, 300);
  });
}
