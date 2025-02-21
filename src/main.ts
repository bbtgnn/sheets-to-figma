import { config } from "./logic/config";
import { propertiesHandlers } from "./logic/properties";
import { setupUiMessagesHandlers, sendMessageToUi } from "./logic/messaging";

//

export default function () {
  figma.showUI(__html__, {
    width: config.viewport.width,
    height: config.viewport.height,
    themeColors: true,
  });

  /* Sending */

  figma.on("selectionchange", () => {
    const selection = figma.currentPage.selection[0] as SceneNode | undefined;
    sendMessageToUi({ type: "ITEM_SELECTED", data: selection?.name });
  });

  /* Receiving */

  setupUiMessagesHandlers({
    MERGE_DATA: async ({ data }) => {
      const selection = figma.currentPage.selection[0];
      if (!selection) return;

      figma.createRectangle();

      const increaseX = selection.width + 20;
      const startX = selection.x + increaseX;
      const startY = selection.y;

      const copiesPromises = data.map(async (item, index) => {
        const copy = selection.clone();
        copy.x = startX + index * increaseX;
        copy.y = startY;

        //

        if (copy.type == "FRAME") {
          for (const [nodeName, nodeProperties] of Object.entries(item)) {
            const items = copy.findAll((node) => node.name === nodeName);
            for (const item of items) {
              for (const [propertyName, propertyValue] of Object.entries(
                nodeProperties
              ))
                await propertiesHandlers[propertyName](item, propertyValue);
            }
          }
        }

        //

        return copy;
      });

      const copies = await Promise.all(copiesPromises);
      figma.viewport.scrollAndZoomIntoView(copies);
      figma.currentPage.selection = copies;

      sendMessageToUi({ type: "MERGE_COMPLETE", data: true });
    },
  });
}
