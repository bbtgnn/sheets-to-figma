import { config } from "./logic/config";
import { propertiesHandlers } from "./logic/properties";
import { setupUiMessagesHandlers, sendMessageToUi } from "./logic/messaging";
import type { Selection } from "./logic/types";
/* Comlink setup */

import * as Comlink from "comlink";
import { uiEndpoint } from "figma-comlink";
import type { UiApi } from "./ui.svelte";

// Exposing

const spreadsheetUrlKey = "spreadsheetUrl";

const api = {
  foo() {
    return "bar";
  },
  getCurrentSelection() {
    return getSelection();
  },

  async storeSpreadsheetUrl(url: string) {
    await figma.clientStorage.setAsync(spreadsheetUrlKey, url);
  },
  async getSpreadsheetUrl() {
    return await figma.clientStorage.getAsync(spreadsheetUrlKey);
  },

  mergeData(nodeId: string, data: object) {},
};

export type PluginApi = typeof api;

Comlink.expose(api, uiEndpoint());

// Receiving

const ui = Comlink.wrap<UiApi>(uiEndpoint());

/* Main */

export default function () {
  figma.showUI(__html__, {
    width: config.viewport.width,
    height: config.viewport.height,
    themeColors: true,
  });

  figma.on("selectionchange", async () => {
    await ui.setSelection(getSelection());
  });

  /* Receiving */

  setupUiMessagesHandlers({
    GET_SELECTION: async () => {
      sendMessageToUi({
        type: "GET_SELECTION_RESPONSE",
        data: figma.currentPage.selection[0],
      });
    },
    STORE_SPREADSHEET_URL: async ({ data }) => {
      await figma.clientStorage.setAsync("spreadsheetUrl", data);
    },
    MERGE_DATA: async ({ data }) => {
      try {
        const selectedNode = figma.currentPage.findOne(
          (node) => node.id == data.selection
        );

        if (!selectedNode) throw new Error("Selected node not found");

        const parentIsFrameAndHasAutoLayout =
          selectedNode.parent?.type == "FRAME" &&
          Boolean(selectedNode.parent?.inferredAutoLayout);

        const parentWithAutoLayout = parentIsFrameAndHasAutoLayout
          ? selectedNode.parent
          : undefined;

        const copiesPromises = data.data.map(async (item, index) => {
          const copy = selectedNode.clone();

          if (!parentIsFrameAndHasAutoLayout) {
            const increaseX = selectedNode.width + 20;
            const startX = selectedNode.x + increaseX;
            const startY = selectedNode.y;

            copy.x = startX + index * increaseX;
            copy.y = startY;
          } else if (parentWithAutoLayout) {
            parentWithAutoLayout.appendChild(copy);
          }

          if (copy.type == "FRAME") {
            for (const [nodeName, nodeProperties] of Object.entries(item)) {
              const items = copy.findAll((node) => node.name === nodeName);

              for (const item of items) {
                for (const [propertyName, propertyValue] of Object.entries(
                  nodeProperties
                )) {
                  try {
                    await propertiesHandlers[propertyName](item, propertyValue);
                  } catch (error) {
                    console.log(item.name, propertyName, propertyValue);
                    console.error(error);
                  }
                }
              }
            }
          }

          return copy;
        });

        const copies = await Promise.all(copiesPromises);
        figma.viewport.scrollAndZoomIntoView(copies);
        figma.currentPage.selection = copies;

        figma.closePlugin();
      } catch (error) {
        sendMessageToUi({
          type: "MERGE_ERROR",
          data: new Error("Merge error"),
        });
      }
    },
  });
}

function getSelection(): Selection {
  return figma.currentPage.selection.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
  }));
}
