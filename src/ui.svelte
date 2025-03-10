<script module lang="ts">
  import type { Selection } from "./logic/types";

  export type UiApi = {
    setSelection(selection: Selection): void;
  };
</script>

<script lang="ts">
  import { config } from "./logic/config";
  import {
    getSheetGidFromUrl,
    getSheetIdFromUrl,
    getSheetRecords,
  } from "./logic/fetch";
  import { onMount } from "svelte";
  import { ok, err } from "true-myth/result";

  /* Comlink setup */

  import * as Comlink from "comlink";
  import { pluginEndpoint } from "figma-comlink";
  import type { PluginApi } from "./main";
  import packageJson from "../package.json";
  import { sendCloseMessage } from "./logic/close";

  const pluginEnd = pluginEndpoint({
    pluginId: packageJson.plugma.manifest.id,
  });

  // Receiving

  const plugin = Comlink.wrap<PluginApi>(pluginEnd);

  // Exposing

  const api: UiApi = {
    setSelection(selection) {
      app.selection = selection;
    },
  };
  Comlink.expose(api, pluginEnd);

  /* App state */

  class App {
    /* Inputs */

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

    sheetUrl = $state("");
    sheetId = $derived(getSheetIdFromUrl(this.sheetUrl));

    spaceBetweenItems = $state(false);

    constructor() {
      onMount(async () => {
        app.selection = await plugin.getCurrentSelection();
        app.sheetUrl = await plugin.getSpreadsheetUrl();
      });
    }

    /* Merging */

    canStartMerge = $derived(this.sheetId.isOk && this.selectedNode.isOk);

    mergeErrors = $state<string[]>([]);
    mergeLoading = $state(false);

    async mergeData() {
      if (!this.sheetId.isOk || !this.selectedNode.isOk) return;

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
        this.selectedNode.value.id,
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

  const app = $state(new App());
</script>

<div
  style:width="{config.viewport.width}px"
  style:height="{config.viewport.height}px"
  class="bg-blue-100 divide-y divide-blue-200 flex flex-col select-none"
>
  <div class="flex items-center gap-4 p-4">
    {@render number(1)}
    <div class="space-y-2 grow">
      <p class="font-medium">Enter the URL of your google spreadsheet</p>
      <input
        type="url"
        bind:value={app.sheetUrl}
        class="border w-full bg-white rounded-xl p-2 py-3 border-blue-200 select-auto"
        placeholder="https://..."
      />
      <div>
        {#if app.sheetId.isOk}
          <p class="text-green-600">✅ URL is valid!</p>
        {:else}
          <p class="text-red-600">❌ URL is invalid!</p>
        {/if}
      </div>
    </div>
  </div>

  <div class="flex items-center gap-4 p-4">
    {@render number(2)}
    <div>
      <p class="font-medium">Select a frame you want to copy and fill</p>
      {#if app.selectedNode.isOk}
        <p class="text-green-600">
          ✅ Selected frame:
          <span class="font-bold">{app.selectedNode.value.name}</span>
        </p>
      {:else}
        <p class="text-red-600">
          ❌ Invalid selection: {app.selectedNode.error.message}
        </p>
      {/if}
    </div>
  </div>

  <div class="flex items-center gap-4 p-4">
    {@render number(3)}
    <div>
      <p class="font-medium">Options</p>
      <label class="flex items-center gap-1.5">
        <input type="checkbox" bind:checked={app.spaceBetweenItems} />
        <p>Space between items</p>
      </label>
    </div>
  </div>

  <div class="p-4">
    <button
      class="bg-orange-500 w-full text-white rounded-full p-4 not-disabled:hover:bg-orange-600 hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      onclick={() => app.mergeData()}
      disabled={!app.canStartMerge}
    >
      Merge that stuff!
    </button>
  </div>

  <div
    class={[
      "px-4 grow flex items-center bg-blue-200",
      {
        "bg-yellow-100 justify-between": app.hasErrors(),
        "justify-center": !app.hasErrors(),
      },
    ]}
  >
    {#if app.hasErrors()}
      <p class="text-yellow-700">
        <span class="font-bold">⚠️ Warning:</span>
        {#if app.mergeErrors.length > 1}
          {app.mergeErrors.length} errors occurred
        {:else}
          {app.mergeErrors[0]}
        {/if}
      </p>

      <button
        class="text-yellow-700 underline hover:cursor-pointer"
        onclick={() => app.toggleShowAllErrorsUi()}
      >
        <p class="text-yellow-700">
          {app.showAllErrorsUi ? "Hide errors" : "Show errors"}
        </p>
      </button>

      <button
        class="bg-yellow-200 hover:bg-yellow-300 size-8 rounded-full hover:cursor-pointer"
        onclick={() => app.clearError()}
      >
        <p class="text-yellow-700">X</p>
      </button>
    {:else}
      <p class="text-sm">
        Made with ❤️ by
        <a
          href="https://bbtgnn.net"
          class="underline hover:bg-white"
          target="_blank"
        >
          Giovanni Abbatepaolo
        </a>
      </p>
    {/if}
  </div>
</div>

{#if app.showAllErrorsUi}
  <div
    style:width="{config.viewport.width}px"
    style:height="{config.viewport.height}px"
    class="bg-yellow-100 flex flex-col fixed top-0 left-0"
  >
    <div
      class="p-4 flex items-center justify-between border-b border-yellow-300"
    >
      <p class="text-yellow-700">
        <span class="font-bold">⚠️ Warning:</span>
        {app.mergeErrors.length} errors occurred
      </p>

      <button
        class="bg-yellow-200 hover:bg-yellow-300 size-8 rounded-full hover:cursor-pointer"
        onclick={() => app.toggleShowAllErrorsUi()}
      >
        <p class="text-yellow-700">X</p>
      </button>
    </div>

    <div class="p-4 space-y-1">
      {#each app.mergeErrors as error}
        <p class="text-yellow-700">{error}</p>
      {/each}
    </div>
  </div>
{/if}

{#snippet number(n: number)}
  <div
    class="text-white bg-blue-600 size-12 flex items-center justify-center rounded-full"
  >
    <p>
      {n}
    </p>
  </div>
{/snippet}
