import "./utils/bigint-polyfill";

//

import { config } from "./logic/config";
import { propertyUpdates } from "./logic/transformations-registry";
import type { Selection } from "./logic/types";
import { Record } from "effect";

/* Comlink setup */

import * as Comlink from "comlink";
import { uiEndpoint } from "figma-comlink";
import type { UiApi } from "./ui.svelte";
import { pipe, Effect as _ } from "effect";
import { setupCloseMessageListener } from "./logic/close";
import { nestifyObject } from "nestify-anything";
import type { SheetCsv } from "./logic/data-fetch";

/* Comlink - Exposing */

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
    nodeId: string,
    data: SheetCsv,
    spaceBetweenItems: boolean
  ) {
    /* Selection validation */

    const selectedNode = figma.currentPage.findOne((node) => node.id == nodeId);
    if (!selectedNode) return;

    const parentNode = selectedNode.parent;
    if (!parentNode) return;
    const parentHasAutoLayout =
      parentNode.type == "FRAME" && Boolean(parentNode.inferredAutoLayout);

    /* Making copies */

    const copiesCount = data.length - 1;
    const copies: SceneNode[] = [];

    for (let i = 0; i < copiesCount; i++) {
      const copy = selectedNode.clone();
      parentNode.appendChild(copy);
      copies.push(copy);
      if (!parentHasAutoLayout && spaceBetweenItems) {
        const increaseX = selectedNode.width + 20;
        const startX = selectedNode.x + increaseX;
        const startY = selectedNode.y;
        copy.x = startX + i * increaseX;
        copy.y = startY;
      }
    }

    figma.viewport.scrollAndZoomIntoView(copies);
    figma.currentPage.selection = copies;

    /* Merging */

    const transformations = data.

    const result = data.map((copyEdits, index) => {
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

      const edits = Object.entries(copyEdits)
        .map(([nodeName, nodeEdits]) => {
          let nodesToEdit: SceneNode[] = [];
          if (copy.name == nodeName) nodesToEdit.push(copy);
          if ("findAll" in copy)
            nodesToEdit.push(...copy.findAll((node) => node.name == nodeName));
          return {
            nodeToEdit: nodesToEdit,
            nodeEdits,
          };
        })
        .filter(({ nodeToEdit }) => nodeToEdit.length > 0)
        .map(({ nodeToEdit, nodeEdits }) =>
          Object.entries(nodeEdits).flatMap(([propertyName, propertyValue]) =>
            nodeToEdit.map((node) =>
              editNodeProperty(node, propertyName, propertyValue)
            )
          )
        )
        .flat();

      return {
        copy: copy as SceneNode,
        edits,
      };
    });


    // TODO - Maybe handle this as a side effect
    figma.viewport.scrollAndZoomIntoView(copies);
    figma.currentPage.selection = copies;

    const operations = result.map(({ edits }) => edits).flat();
    return await pipe(
      _.partition(operations, (o) => o),
      _.map(([failures, _]) => failures.map((f) => f.message)),
      _.runPromise
    );
  },
};

export type PluginApi = typeof api;

Comlink.expose(api, uiEndpoint());

/* Comlink - Receiving */

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
  }));
}

//

function editNodeProperty(node: SceneNode, property: string, value: unknown) {
  const transformation = pipe(
    _.fromNullable(propertyUpdates[property]),
    _.flatMap((handler) =>
      _.tryPromise({
        try: () => handler(node, value) as Promise<void>,
        catch: (e) => {
          console.error(
            `Error setting property "${property}" on node "${node.name}"`,
            handler,
            e
          );
          return new Error(
            `${node.name}: Error setting property "${property}"`
          );
        },
      })
    )
  );
  return transformation;
}
