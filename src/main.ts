import "./utils/url-polyfill";

//

import { config } from "./logic/config";
import {
  propertiesHandlers,
  preloadFontsForTextProperties,
} from "./logic/properties";
import type { Selection } from "./logic/types";
import type { SheetRecords } from "./logic/fetch";

/* Comlink setup */

import * as Comlink from "comlink";
import { uiEndpoint } from "figma-comlink";
import type { UiApi } from "./ui.svelte";
import * as Result from "true-myth/result";
import * as Task from "true-myth/task";
import { setupCloseMessageListener } from "./logic/close";
import { nestifyObject } from "nestify-anything";

// Exposing

const spreadsheetUrlKey = "spreadsheetUrl";

const api = {
  getCurrentSelection() {
    return getSelection();
  },

  async storeSpreadsheetUrl(url: string) {
    await figma.clientStorage.setAsync(spreadsheetUrlKey, url);
  },
  async getSpreadsheetUrl() {
    return await figma.clientStorage.getAsync(spreadsheetUrlKey);
  },

  async mergeData(
    nodeIds: string[],
    data: SheetRecords,
    spaceBetweenItems: boolean
  ) {
    // Selection validation
    const selectedNodes = nodeIds
      .map((nodeId) => figma.currentPage.findOne((node) => node.id == nodeId))
      .filter((node) => node !== null);

    if (selectedNodes.length === 0 || selectedNodes.length != nodeIds.length) {
      return;
    }

    const selectionHasOneParent = selectedNodes.every(
      (node) => node.parent?.id === selectedNodes[0].parent?.id
    );
    if (!selectionHasOneParent) {
      return;
    }

    const parentNode = selectedNodes[0].parent;
    if (!parentNode) return;

    const parentHasAutoLayout =
      parentNode.type == "FRAME" && Boolean(parentNode.inferredAutoLayout);

    // Data validation
    // We get only the records that have a single dot in the key
    // a.k.a two levels of nesting

    const cleanedData = data
      .map((record) =>
        Object.fromEntries(
          Object.entries(record).filter(([key]) => {
            const dotCount = (key.match(/\./g) || []).length;
            if (dotCount !== 1) return false;
            const matches = key.match(/\w+\.\w+/g);
            return matches !== null && matches.length > 0;
          })
        )
      )
      .map((record) => nestifyObject(record)) as Record<
      string,
      Record<string, unknown>
    >[];

    // Merge (insertChild + sequential order for low-end devices)

    type EditItem = {
      node: SceneNode;
      propertyName: string;
      propertyValue: unknown;
    };

    const result: { copy: SceneNode; editItems: EditItem[] }[] = [];
    for (const selectedNode of selectedNodes) {
      for (let index = 0; index < cleanedData.length; index++) {
        const copyEdits = cleanedData[index];
        const copy = selectedNode.clone();

        parentNode.appendChild(copy);
        if (!parentHasAutoLayout && spaceBetweenItems) {
          const increaseX = selectedNode.width + 20;
          const startX = selectedNode.x + increaseX;
          const startY = selectedNode.y;
          copy.x = startX + index * increaseX;
          copy.y = startY;
        }

        // TODO - First swap instance, then apply edits

        const editItems: EditItem[] = Object.entries(copyEdits)
          .map(([nodeName, nodeEdits]) => {
            let nodesToEdit: SceneNode[] = [];
            if (copy.name == nodeName) nodesToEdit.push(copy);
            if ("findAll" in copy)
              nodesToEdit.push(
                ...copy.findAll((node) => node.name == nodeName)
              );
            return {
              nodeToEdit: nodesToEdit,
              nodeEdits,
            };
          })
          .filter(({ nodeToEdit }) => nodeToEdit.length > 0)
          .flatMap(({ nodeToEdit, nodeEdits }) =>
            Object.entries(nodeEdits).flatMap(([propertyName, propertyValue]) =>
              nodeToEdit.map((node) => ({
                node,
                propertyName,
                propertyValue,
              }))
            )
          );

        result.push({ copy: copy as SceneNode, editItems });
      }
    }

    const copies = result.map(({ copy }) => copy);
    figma.viewport.scrollAndZoomIntoView(copies);
    figma.currentPage.selection = copies;

    const allEditItems = result.flatMap(({ editItems }) => editItems);
    await preloadFontsForTextProperties(
      allEditItems.map(({ node, propertyName }) => ({ node, property: propertyName }))
    );

    const operations = allEditItems.map(({ node, propertyName, propertyValue }) =>
      editNodeProperty(node, propertyName, propertyValue)
    );
    const results = await Promise.all(operations.map((t) => t));
    return results.filter((r) => r.isErr).map((r) => r.error.message);
  },
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

  setupCloseMessageListener();
}

/* Utils */

function getSelection(): Selection {
  return figma.currentPage.selection.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    parentId: node.parent?.id,
  }));
}

//

function editNodeProperty(
  node: SceneNode,
  property: string,
  value: unknown
): Task.Task<void, Error> {
  const handler = propertiesHandlers[property];
  if (!handler) {
    return Task.reject(new Error(`No handler for property "${property}"`));
  }
  return Task.safelyTryOrElse(
    (e) => {
      console.warn(
        `Error setting property "${property}" on node "${node.name}"`,
        handler,
        e
      );
      return new Error(
        `${node.name}: Error setting property "${property}"`
      ) as Error;
    },
    () => handler(node, value) as Promise<void>
  );
}
