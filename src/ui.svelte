<script module lang="ts">
  import type { Selection } from "./logic/types";

  export type UiApi = {
    setSelection(selection: Selection): void;
  };
</script>

<script lang="ts">
  import { config } from "./logic/config";
  import packageJson from "../package.json";
  import { App } from "./ui.svelte.js";

  const app = new App();
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
      {#if !app.selectionError}
        <p class="text-green-600">
          ✅ Selected items:
          <span class="font-bold"
            >{app.selection.map((node) => node.name).join(", ")}</span
          >
        </p>
      {:else}
        <p class="text-red-600">
          ❌ Invalid selection: {app.selectionError.message}
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
        <span class="text-black/10 absolute right-2 text-xs bottom-1">
          Version {packageJson.plugma.pluginVersion}
        </span>
      </p>
    {/if}
  </div>

  {#if app.mergeLoading}
    <div class="absolute inset-0 bg-black/50 flex items-center justify-center">
      <div
        class="size-12 border-4 border-white border-t-transparent rounded-full animate-spin"
      ></div>
    </div>
  {/if}
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
