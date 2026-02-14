import type { Selection } from "./logic/types";

import {
  getSheetGidFromUrl,
  getSheetIdFromUrl,
  getSheetRecords,
} from "./logic/fetch";
import { onMount } from "svelte";
import {
  sendCloseMessage,
  setupSelectionMessageListener,
} from "./logic/messaging";

/* Comlink setup */

import * as Comlink from "comlink";
import { pluginEndpoint } from "figma-comlink";
import type { PluginApi } from "./main";
import packageJson from "../package.json";

const pluginEnd = pluginEndpoint({
  pluginId: packageJson.plugma.manifest.id,
});

const plugin = Comlink.wrap<PluginApi>(pluginEnd);

//

export class App {
  /* Inputs */

  selection = $state<Selection>([]);
  selectionError = $derived.by(() => {
    if (this.selection.length === 0) {
      return new Error("No selection");
    }
    const selectionHasOneParent = this.selection.every(
      (node) => node.parentId === this.selection[0].parentId
    );
    if (!selectionHasOneParent) {
      return new Error(
        "If you want to select multiple items, they must have the same parent"
      );
    }
    return undefined;
  });

  sheetUrl = $state("");
  sheetId = $derived(getSheetIdFromUrl(this.sheetUrl));

  spaceBetweenItems = $state(false);

  constructor() {
    onMount(async () => {
      this.selection = await plugin.getCurrentSelection();
      this.sheetUrl = await plugin.getSpreadsheetUrl();
    });

    setupSelectionMessageListener((selection) => {
      this.selection = selection;
    });
  }

  /* Merging */

  canStartMerge = $derived(this.sheetId.isOk && !this.selectionError);

  mergeErrors = $state<string[]>([]);
  mergeLoading = $state(false);

  async mergeData() {
    if (!this.sheetId.isOk || this.selectionError) return;

    this.mergeErrors = [];
    this.mergeLoading = true;

    const sheetId = this.sheetId.value;
    const gid = getSheetGidFromUrl(this.sheetUrl);
    const records = await getSheetRecords(sheetId, gid.unwrapOr(0));

    if (records.isErr) {
      this.mergeErrors = [records.error.message];
      this.mergeLoading = false;
      return;
    }

    await plugin.storeSpreadsheetUrl(this.sheetUrl);

    const failures = await plugin.mergeData(
      this.selection.map((node) => node.id),
      records.value,
      this.spaceBetweenItems
    );

    if (failures) this.mergeErrors = failures;
    this.mergeLoading = false;

    sendCloseMessage();
  }

  hasErrors() {
    return this.mergeErrors.length > 0;
  }

  clearError() {
    this.mergeErrors = [];
  }

  showAllErrorsUi = $state(false);

  toggleShowAllErrorsUi() {
    this.showAllErrorsUi = !this.showAllErrorsUi;
  }
}
