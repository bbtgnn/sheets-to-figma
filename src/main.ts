import { config } from "./logic/config";
import { propertiesHandlers } from "./logic/properties";
import type { Selection } from "./logic/types";
import type { SheetRecord } from "./logic/fetch";

/* Comlink setup */

import * as Comlink from "comlink";
import { uiEndpoint } from "figma-comlink";
import type { UiApi } from "./ui.svelte";
// import { pipe, Effect as _, Either } from "effect";

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

  async mergeData(nodeId: string, data: SheetRecord[]) {
    // const selectedNode = figma.currentPage.findOne((node) => node.id == nodeId);
    // if (!selectedNode) return;
    // const parentNode = selectedNode.parent;
    // if (!parentNode) return;
    // const parentHasAutoLayout =
    //   parentNode.type == "FRAME" && Boolean(parentNode.inferredAutoLayout);
    // const result = _.validateAll(data, (item, index) => {
    //   const copy = selectedNode.clone();
    //   parentNode.appendChild(copy);
    //   if (!parentHasAutoLayout) {
    //     const increaseX = selectedNode.width + 20;
    //     const startX = selectedNode.x + increaseX;
    //     const startY = selectedNode.y;
    //     copy.x = startX + index * increaseX;
    //     copy.y = startY;
    //   }
    //   const nodesToEdit: SceneNode[] = [];
    //   if (copy.name in item) nodesToEdit.push(copy);
    //   if ("findAll" in copy)
    //     nodesToEdit.push(...copy.findAll((node) => node.name in item));
    //   const operations = _.validateAll(nodesToEdit, (node) =>
    //     pipe(
    //       _.fromNullable(item[node.name]),
    //       _.flatMap((data) => {
    //         if (typeof data === "object" && data !== null)
    //           return _.succeed(data);
    //         else
    //           return _.fail(
    //             new Error(`Node properties are not an object for ${node.name}`)
    //           );
    //       }),
    //       _.map(Object.entries),
    //       _.flatMap((properties) =>
    //         _.validateAll(properties, ([propertyName, propertyValue]) =>
    //           pipe(
    //             _.fromNullable(propertiesHandlers[propertyName]),
    //             _.flatMap((handler) =>
    //               _.tryPromise({
    //                 try: () => handler(node, propertyValue) as Promise<void>,
    //                 catch: () =>
    //                   new Error(`Error setting property ${propertyName} `),
    //               })
    //             )
    //           )
    //         )
    //       )
    //     )
    //   );
    //   return operations.pipe(_.map(() => copy as SceneNode));
    // });
    // const effect = result.pipe(
    //   _.either,
    //   _.andThen((result) => {
    //     if (Either.isRight(result)) {
    //       figma.viewport.scrollAndZoomIntoView(result.right);
    //       figma.currentPage.selection = result.right;
    //       figma.closePlugin();
    //     } else {
    //       ui.notifyFailure(result.left.map((e) => e.flat()).flat()[0]);
    //     }
    //   })
    // );
    // await _.runPromiseExit(effect);
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
}

function getSelection(): Selection {
  return figma.currentPage.selection.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
  }));
}
