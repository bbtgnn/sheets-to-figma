<script lang="ts">
	import { getSheetData } from './logic';
	import { sendMessageToFigma, setupFigmaMessagesHandlers } from './logic/messaging';

	/* Sending */

	let spreadsheetUrl = $state(
		'https://docs.google.com/spreadsheets/d/1nqOo7l1558YZaEXLKq_Ke-18IjyWOy5MBfFF90fbUHc/edit?usp=sharing'
	);

	async function onClick() {
		loading = true;
		const response = await getSheetData(spreadsheetUrl, 0);
		sendMessageToFigma({ type: 'MERGE_DATA', data: response });
	}

	/* Receiving */

	let selection = $state<SceneNode | undefined>(undefined);
	let loading = $state(false);

	setupFigmaMessagesHandlers({
		ITEM_SELECTED: ({ data }) => {
			selection = data;
		},
		MERGE_COMPLETE: () => {
			loading = false;
		}
	});
</script>

<div class="container">
	<pre>{JSON.stringify(selection, null, 2)}</pre>
	<hr />

	<input type="text" bind:value={spreadsheetUrl} />

	<button onclick={onClick}>ciaoo</button>

	{#if loading}
		<div class="loading">Loading...</div>
	{/if}
</div>
