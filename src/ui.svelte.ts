import type { Selection } from "./logic/types";
import { onMount } from "svelte";
import { getSheetIdFromUrl, fetchSheetCsv } from "./logic/data-fetch";
import { sendCloseMessage } from "./logic/close";
import { pipe, Effect as _ } from "effect";
import type { PluginApi } from "./main";
import * as Comlink from "comlink";

export class App {
  constructor(plugin: Comlink.Remote<PluginApi>) {
    onMount(async () => {
      this.selection = await plugin.getCurrentSelection();
      this.sheetUrl = await plugin.getSpreadsheetUrl();
    });
  }

  /* Sheet URL */

  sheetUrl = $state("");
  isSheetUrlValid = $derived.by(() =>
    pipe(
      getSheetIdFromUrl(this.sheetUrl),
      _.match({
        onSuccess: () => true,
        onFailure: () => false,
      }),
      _.runSync
    )
  );

  /* Figma selection */

  selection = $state<Selection>([]);
  selectedNode = $derived(this.selection.at(0));

  selectionError = $derived.by(() => {
    if (this.selection.length === 0) {
      return new Error("No selection");
    } else if (this.selection.length > 1) {
      return new Error("Multiple selection");
    }
  });

  /* Options */

  spaceBetweenItems = $state(false);

  /* Merging */

  canStartMerge = $derived(
    this.isSheetUrlValid && this.selectedNode !== undefined
  );

  async mergeData() {
    const csv = await fetchSheetCsv(this.sheetUrl).pipe(_.runPromise);
    console.log(csv);
  }

  /* Error */

  showErrorsUi = $state(false);

  //

  //   /* Inputs */

  //   selection = $state<Selection>([]);

  //   sheetUrl = $state("");
  //   sheetId = $derived(getSheetIdFromUrl(this.sheetUrl));

  //   spaceBetweenItems = $state(false);

  //   /* Merging */

  //   // canStartMerge = $derived(this.sheetId.isOk && this.selectedNode.isOk);

  //   mergeErrors = $state<string[]>([]);
  //   mergeLoading = $state(false);

  //   async mergeData() {
  //     // if (!this.sheetId.isOk || !this.selectedNode.isOk) return;

  //     // this.mergeErrors = [];
  //     // this.mergeLoading = true;

  //     // const sheetId = this.sheetId.value;
  //     // const gid = getSheetGidFromUrl(this.sheetUrl);
  //     // const records = await getSheetRecords(sheetId, gid.unwrapOr(0));

  //     // if (records.isErr) {
  //     //   this.mergeErrors = [records.error.message];
  //     //   this.mergeLoading = false;
  //     //   return;
  //     // }

  //     // await plugin.storeSpreadsheetUrl(this.sheetUrl);

  //     // const failures = await plugin.mergeData(
  //     //   this.selectedNode.value.id,
  //     //   records.value,
  //     //   this.spaceBetweenItems
  //     // );

  //     // if (failures) this.mergeErrors = failures;
  //     // this.mergeLoading = false;

  //     sendCloseMessage();
  //   }

  //   hasErrors() {
  //     return this.mergeErrors.length > 0;
  //   }

  //   clearError() {
  //     this.mergeErrors = [];
  //   }

  //   showAllErrorsUi = $state(false);

  //   toggleShowAllErrorsUi() {
  //     this.showAllErrorsUi = !this.showAllErrorsUi;
  //   }
}
