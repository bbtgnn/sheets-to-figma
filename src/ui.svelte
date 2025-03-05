<script module lang="ts">
  import type { Selection } from "./logic/types";

  export type UiApi = {
    setSelection(selection: Selection): void;
    notifyFailure(error: Error): void;
  };
</script>

<script lang="ts">
  import { config } from "./logic/config";
  import { getSheetIdFromUrl, getSheetRecords } from "./logic/fetch";
  import { onMount } from "svelte";
  import { ok, err } from "true-myth/result";

  /* Comlink setup */

  import * as Comlink from "comlink";
  import { pluginEndpoint } from "figma-comlink";
  import type { PluginApi } from "./main";
  import packageJson from "../package.json";

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
    notifyFailure(error) {
      app.mergeError = error;
    },
  };
  Comlink.expose(api, pluginEnd);

  /* App state */

  class App {
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

    canStartMerge = $derived(this.sheetId.isOk && this.selectedNode.isOk);

    mergeLoading = $state(false);
    mergeError = $state<Error>();

    async mergeData() {
      this.mergeLoading = true;
      this.mergeError = undefined;

      if (!this.sheetId.isOk || !this.selectedNode.isOk) return;

      const sheetId = this.sheetId.value;
      const records = await getSheetRecords(sheetId);

      if (records.isErr) {
        this.mergeError = records.error;
        return;
      }

      await plugin.storeSpreadsheetUrl(this.sheetUrl);

      const mergeResult = await plugin.mergeData(
        this.selectedNode.value.id,
        records.value
      );
      console.log(mergeResult);
    }

    clearError() {
      this.mergeError = undefined;
    }
  }

  const app = $state(new App());

  /* Receiving */

  onMount(async () => {
    app.selection = await plugin.getCurrentSelection();
    app.sheetUrl = await plugin.getSpreadsheetUrl();
  });
</script>

<div
  style:width="{config.viewport.width}px"
  style:height="{config.viewport.height}px"
  class="bg-blue-100 divide-y divide-blue-200 flex flex-col"
>
  <div class="flex items-center gap-4 p-4">
    {@render number(1)}
    <div class="space-y-2 grow">
      <p class="font-medium">Enter the URL of your google spreadsheet</p>
      <input
        type="url"
        bind:value={app.sheetUrl}
        class="border w-full bg-white rounded-xl p-2 py-3 border-blue-200"
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
        "bg-red-600 justify-between": app.mergeError,
        "justify-center": !app.mergeError,
      },
    ]}
  >
    {#if app.mergeError}
      <p class="text-white">
        <span class="font-bold">⚠️ Error:</span>
        {app.mergeError.message}
      </p>
      <button
        class="bg-white/40 hover:bg-white/60 size-8 rounded-full hover:cursor-pointer"
        onclick={() => app.clearError()}
      >
        <p class="text-white">X</p>
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

{#snippet number(n: number)}
  <div
    class="text-white bg-blue-600 size-12 flex items-center justify-center rounded-full"
  >
    <p>
      {n}
    </p>
  </div>
{/snippet}
