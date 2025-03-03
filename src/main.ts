import { config } from "./logic/config";
import { propertiesHandlers } from "./logic/properties";
import {
  setupUiMessagesHandlers,
  sendMessageToUi,
  type Selection,
} from "./logic/messaging";
import { z } from "zod";

//

export default function () {
  figma.showUI(__html__, {
    width: config.viewport.width,
    height: config.viewport.height,
    themeColors: true,
  });

  /* Sending */

  figma.on("selectionchange", () => {
    const selection = getSelection();
    if (!selection) {
      sendMessageToUi({ type: "INVALID_SELECTION", data: undefined });
    } else {
      sendMessageToUi({
        type: "ITEM_SELECTED",
        data: {
          selection,
        },
      });
    }
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

function getSelection(): Selection | undefined {
  const selection = figma.currentPage.selection;
  if (selection.length == 0 || selection.length > 1) {
    return undefined;
  } else {
    const selectedNode = selection[0];
    if (selectedNode.type != "FRAME") {
      return undefined;
    } else {
      return {
        id: selectedNode.id,
        name: selectedNode.name,
      };
    }
  }
}
