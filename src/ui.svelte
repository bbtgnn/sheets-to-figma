<script module lang="ts">
  import type { Selection } from "./logic/types";

  export type UiApi = {
    test(): void;
    setSelection(selection: Selection): void;
  };
</script>

<script lang="ts">
  import {
    sendMessageToFigma,
    setupFigmaMessagesHandlers,
  } from "./logic/messaging";
  import { config } from "./logic/config";
  import { getSheetData } from "./logic/fetch";
  import type { SheetData } from "./logic/fetch";
  import { onMount } from "svelte";

  /* Comlink setup */

  import * as Comlink from "comlink";
  import { pluginEndpoint } from "figma-comlink";
  import type { PluginApi } from "./main";
  import packageJson from "../package.json";
  import { ok, err } from "true-myth/result";

  const pluginEnd = pluginEndpoint({
    pluginId: packageJson.plugma.manifest.id,
  });

  // Receiving

  const plugin = Comlink.wrap<PluginApi>(pluginEnd);

  // Exposing

  const api: UiApi = {
    test() {
      console.log("connection_success");
    },
    setSelection(selection) {
      appState.selection = selection;
    },
  };
  Comlink.expose(api, pluginEnd);

  /* App state */

  class AppState {
    selection = $state<Selection>([]);
    selectedNode = $derived.by(() => {
      if (this.selection.length === 1) {
        return ok(this.selection[0]);
      } else if (this.selection.length === 0) {
        return err(new Error("No selection"));
      } else {
        return err(new Error("Multiple selection"));
      }
    });

    sheetUrl = $state<string>();
    sheetData = $state<SheetData | Error>();
    sheetDataLoading = $state(false);
    mergeLoading = $state<boolean | Error>(false);

    canMerge = $derived(
      !(this.sheetData instanceof Error) && this.selectedNode.isOk
    );
  }

  const appState = $state(new AppState());

  /* Getting data */

  async function onInputChange(newUrl: string | undefined) {
    if (!newUrl) return;
    appState.sheetDataLoading = true;
    appState.sheetData = await getSheetData(newUrl, 0);
    appState.sheetDataLoading = false;
    if (!(appState.sheetData instanceof Error) && Boolean(appState.sheetData)) {
      sendMessageToFigma({
        type: "STORE_SPREADSHEET_URL",
        data: newUrl,
      });
    }
  }

  /* Merging */

  async function onClick() {
    if (
      appState.sheetData instanceof Error ||
      !appState.sheetData ||
      !appState.selection
    )
      return;
    appState.mergeLoading = true;
    sendMessageToFigma({
      type: "MERGE_DATA",
      data: {
        selection: appState.selection.id,
        data: $state.snapshot(appState.sheetData),
      },
    });
  }

  /* Receiving */

  onMount(async () => {
    appState.selection = await plugin.getCurrentSelection();
    appState.sheetUrl = await plugin.getSpreadsheetUrl();
  });
</script>

<div
  style:width="{config.viewport.width}px"
  style:height="{config.viewport.height}px"
  class="bg-blue-100 divide-y divide-blue-200"
>
  <div class="flex items-center gap-4 p-4">
    {@render number(1)}
    <div class="space-y-2 grow">
      <p>Enter the URL of your google spreadsheet</p>
      <input
        type="url"
        bind:value={appState.sheetUrl}
        class="border w-full bg-white rounded-xl p-2 py-3 border-blue-200"
        placeholder="https://..."
      />
      <div>
        <div>
          <!-- {#if appState.sheetDataLoading}
            <p>🔄 Loading...</p>
          {:else if appState.sheetData instanceof Error}
            <p>❌ {appState.sheetData.message}</p>
          {:else}
            <p>✅ Data loaded successfully!</p>
          {/if} -->
        </div>
      </div>
    </div>
  </div>

  <div class="flex items-center gap-4 p-4">
    {@render number(2)}
    <div>
      <p>Select a frame you want to copy and fill</p>
      {#if appState.selectedNode.isOk}
        <p>✅ Selected frame: {appState.selectedNode.value.name}</p>
      {:else}
        <p>❌ Invalid selection: {appState.selectedNode.error.message}</p>
      {/if}
    </div>
  </div>

  <div class="p-4">
    {#if appState.canMerge}
      <button
        class="bg-orange-500 w-full text-white rounded-full p-4 hover:bg-orange-600 hover:cursor-pointer"
        onclick={onClick}>Merge that stuff!</button
      >
    {/if}

    {#if appState.mergeLoading === true}
      <p>Loading...</p>
    {:else if appState.mergeLoading instanceof Error}
      <p>{appState.mergeLoading.message}</p>
    {/if}
  </div>
  <!-- 


  {#if appState == "ready"}
    <button onclick={onClick}>Merge that stuff!</button>
  {/if}

  {#if appState == "loading"}
    <div class="loading">Loading...</div>
  {/if} -->
</div>

{#snippet number(n: number)}
  <div
    class="text-white bg-blue-600 size-12 flex items-center justify-center rounded-full"
  >
    <p>
      {n}
    </p>
  </div>
{/snippet}
