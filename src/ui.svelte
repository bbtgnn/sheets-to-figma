<script lang="ts">
  import {
    sendMessageToFigma,
    setupFigmaMessagesHandlers,
    type Selection,
  } from "./logic/messaging";
  import { config } from "./logic/config";
  import { getSheetData } from "./logic/fetch";
  import type { SheetData } from "./logic/fetch";
  import { onMount } from "svelte";
  import { z } from "zod";

  /* App state*/

  class AppState {
    sheetData = $state<SheetData | Error>();
    sheetDataLoading = $state(false);
    selection = $state<Selection>();
    mergeLoading = $state<boolean | Error>(false);

    canMerge = $derived(
      !(this.sheetData instanceof Error) && this.selection !== undefined
    );
  }

  const appState = $state(new AppState());

  /* Getting data */

  let spreadsheetUrl = $state<string>();

  $effect(() => {
    onInputChange(spreadsheetUrl);
  });

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

  onMount(() => {
    sendMessageToFigma({
      type: "GET_SELECTION",
      data: undefined,
    });
  });

  setupFigmaMessagesHandlers({
    GET_SELECTION_RESPONSE: ({ data }) => {
      appState.selection = data;
    },
    ITEM_SELECTED: ({ data }) => {
      appState.selection = data?.selection;
    },
    MERGE_COMPLETE: () => {
      appState.mergeLoading = false;
    },
    MERGE_ERROR: ({ data }) => {
      appState.mergeLoading = data;
    },
    INVALID_SELECTION: () => {
      appState.selection = undefined;
    },
    RESTORE_SPREADSHEET_URL: ({ data }) => {
      console.log("RESTORE_SPREADSHEET_URL", data);
      spreadsheetUrl = data;
    },
  });
</script>

<div
  style:width="{config.viewport.width}px"
  style:height="{config.viewport.height}px"
  class="bg-blue-100 divide-y divide-blue-200"
>
  <!-- <pre>{JSON.stringify(selection, null, 2)}</pre>
  <hr /> -->

  <div class="flex items-center gap-4 p-4">
    {@render number(1)}
    <div class="space-y-2 grow">
      <p>Enter the URL of your google spreadsheet</p>
      <input
        type="url"
        bind:value={spreadsheetUrl}
        class="border w-full bg-white rounded-xl p-2 py-3 border-blue-200"
        placeholder="https://..."
      />
      <div>
        <div>
          {#if appState.sheetDataLoading}
            <p>🔄 Loading...</p>
          {:else if appState.sheetData instanceof Error}
            <p>❌ {appState.sheetData.message}</p>
          {:else}
            <p>✅ Data loaded successfully!</p>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <div class="flex items-center gap-4 p-4">
    {@render number(2)}
    <div>
      <p>Select a frame you want to copy and fill</p>
      {#if appState.selection}
        <p>✅ Selected frame: {appState.selection.name}</p>
      {:else}
        <p>❌ Invalid selection: no frame selected</p>
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
