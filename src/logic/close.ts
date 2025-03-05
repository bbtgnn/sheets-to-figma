const CLOSE_MESSAGE = "close";

export function sendCloseMessage() {
  parent.postMessage({ pluginMessage: CLOSE_MESSAGE }, "*");
}

export function setupCloseMessageListener() {
  figma.ui.onmessage = (message) => {
    if (message == CLOSE_MESSAGE) figma.closePlugin();
  };
}
