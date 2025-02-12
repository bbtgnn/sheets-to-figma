// Read the docs https://plugma.dev/docs

import { propertiesHandlers } from "./logic/properties";
import type { Message } from "./types";

export default function () {
  figma.showUI(__html__, { width: 300, height: 260, themeColors: true });

  figma.ui.onmessage = async (message: Message) => {
    if (message.type === "MERGE_DATA") {
      const selection = figma.currentPage.selection[0];
      if (!selection) return;

      figma.createRectangle();

      const increaseX = selection.width + 20;
      const startX = selection.x + increaseX;
      const startY = selection.y;

      const copiesPromises = message.data.map(async (item, index) => {
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
    }
  };

  function postNodeCount() {
    const nodeCount = figma.currentPage.selection.length;
    figma.currentPage.selection[0];

    figma.ui.postMessage({
      type: "POST_NODE_COUNT",
      count: nodeCount,
    });
  }

  figma.on("selectionchange", postNodeCount);
}
