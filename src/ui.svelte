<script lang="ts">
  import { getSheetData } from "./logic";
  import {
    sendMessageToFigma,
    setupFigmaMessagesHandlers,
  } from "./logic/messaging";
  import { config } from "./logic/config";

  /* Sending */

  let spreadsheetUrl = $state(
    "https://docs.google.com/spreadsheets/d/1nqOo7l1558YZaEXLKq_Ke-18IjyWOy5MBfFF90fbUHc/edit?usp=sharing"
  );

  async function onClick() {
    appState = "loading";
    const response = await getSheetData(spreadsheetUrl, 0);
    sendMessageToFigma({ type: "MERGE_DATA", data: response });
  }

  /* Receiving */

  let selection = $state<string | undefined>(undefined);
  let loading = $state(false);

  setupFigmaMessagesHandlers({
    ITEM_SELECTED: ({ data }) => {
      selection = data;
    },
    MERGE_COMPLETE: () => {
      appState = "ready";
    },
  });

  type ProcedureState = "success" | "error" | "todo";

  type AppState = "loading" | "input" | "ready";

  let appState = $state<AppState>("input");
</script>

<div
  style:width="{config.viewport.width}px"
  style:height="{config.viewport.height}px"
  class="bg-purple-200"
>
  <!-- <pre>{JSON.stringify(selection, null, 2)}</pre>
  <hr /> -->

  <div class="flex items-center gap-4">
    {@render number(1, "todo")}
    <div>
      <p>Enter the URL of your google spreadsheet</p>
      <input type="url" bind:value={spreadsheetUrl} class="border w-full" />
    </div>
  </div>

  <div class="flex items-center gap-4">
    {@render number(2, "todo")}
    <div>
      <p>Select the element you want to copy and fill</p>
      {#if selection}
        <p>Selected item: {selection}</p>
      {:else}
        <p>No object selected</p>
      {/if}
    </div>
  </div>

  {#if appState == "ready"}
    <button onclick={onClick}>Merge that stuff!</button>
  {/if}

  {#if appState == "loading"}
    <div class="loading">Loading...</div>
  {/if}
</div>

{#snippet number(n: number, status: ProcedureState)}
  <div
    class={[
      "text-white size-16 flex items-center justify-center rounded-full",
      {
        "bg-green-500": status == "success",
        "bg-gray-300": status == "todo",
        "bg-red-500": status == "error",
      },
    ]}
  >
    <p>
      {n}
    </p>
  </div>
{/snippet}
