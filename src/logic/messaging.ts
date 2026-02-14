import type { Selection } from "./types";

const CLOSE_MESSAGE = "close";

export function sendCloseMessage() {
  parent.postMessage({ pluginMessage: CLOSE_MESSAGE }, "*");
}

export function setupCloseMessageListener() {
  figma.ui.onmessage = (message) => {
    if (message == CLOSE_MESSAGE) figma.closePlugin();
  };
}

//

const SELECTION_MESSAGE = "selection";

export function sendSelectionMessage(selection: Selection) {
  figma.ui.postMessage({ type: SELECTION_MESSAGE, selection });
}

export function setupSelectionMessageListener(
  callback: (selection: Selection) => void
) {
  onmessage = (event) => {
    if (event.data.type === SELECTION_MESSAGE) {
      callback(event.data.selection);
    }
  };
}
