<script lang="ts">
	type Settings = {
		fontSize: 'small' | 'medium' | 'large' | 'xlarge';
		background: 'off' | 'low' | 'medium' | 'high';
		// Stored for the planned timed auto-hide; current controls use CSS hover/focus.
		controlsDelay: number;
	};
	// Defaults are also passed to storage.get so older installs automatically gain
	// newly introduced settings without a migration step.
	const defaults: Settings = {
		fontSize: 'medium',
		background: 'medium',
		controlsDelay: 2200
	};
	let settings = $state<Settings>(defaults);
	let saved = $state(false);
	async function load() {
		const stored = await chrome.storage.local.get(defaults);
		settings = { ...defaults, ...stored } as Settings;
	}
	// Preferences are global extension settings; subtitle file contents are never stored here.
	async function save() {
		await chrome.storage.local.set(settings);
		saved = true;
	}
	load();
</script>

<main>
	<h1>Custom PiP settings</h1>
	<label>
		Subtitle font size
		<select bind:value={settings.fontSize}>
			<option value="small">Small</option>
			<option value="medium">Medium</option>
			<option value="large">Large</option>
			<option value="xlarge">Extra Large</option>
		</select>
	</label>
	<label>
		Subtitle background
		<select bind:value={settings.background}>
			<option value="off">Off</option>
			<option value="low">Low</option>
			<option value="medium">Medium</option>
			<option value="high">High</option>
		</select>
	</label>
	<label>
		Controls auto-hide (ms)
		<input type="number" min="500" max="10000" step="100" bind:value={settings.controlsDelay} />
	</label>
	<button onclick={save}>Save</button>
	{#if saved}<span> Saved.</span>{/if}
</main>

<style>
	main {
		max-width: 580px;
		margin: 40px auto;
		padding: 20px;
		font: 16px system-ui;
	}
	label {
		display: grid;
		gap: 7px;
		margin: 18px 0;
	}
	select,
	input {
		padding: 8px;
	}
	button {
		padding: 9px 16px;
		background: #2563eb;
		color: #fff;
		border: 0;
		border-radius: 6px;
	}
</style>
