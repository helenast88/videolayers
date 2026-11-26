import { $aiStatus, $aiSubs } from "@src/models/aiSubs";
import { isAudioProtected } from "@src/utils/aiSubs/status";

// Between the toolbar window and the page: whether the tab's sound is needed for the AI subtitles, and whether it's
// being heard. The page knows the first; the window tells it the second, since the capture starts from there.
export const TAB_LISTENING_ASKED = "videolayers:tabListeningAsked";
export const TAB_LISTENING_CHANGED = "videolayers:tabListeningChanged";

export type TTabListening = { needed: boolean; listening: boolean };

let listening = false;

export const tabListeningState = (): TTabListening => ({
  // While the tab is heard the video may stop looking protected; the window still has to offer Stop
  needed: listening || ($aiSubs.getState() !== null && isAudioProtected($aiStatus.getState())),
  listening,
});

export const listenForTabListening = () => {
  chrome.runtime.onMessage?.addListener((message, _sender, sendResponse) => {
    if (message?.type === TAB_LISTENING_ASKED) {
      sendResponse(tabListeningState());
    } else if (message?.type === TAB_LISTENING_CHANGED) {
      listening = !!message.listening;
    }
    return undefined;
  });
};
