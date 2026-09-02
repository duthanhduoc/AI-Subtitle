<script lang="ts">
	type Settings = {
		// Được lưu cho tính năng tự ẩn theo thời gian dự kiến; controls hiện dùng CSS hover/focus.
		controlsDelay: number;
	};
	// Giá trị mặc định cũng được truyền vào storage.get để bản cài cũ tự nhận setting
	// mới mà không cần bước chuyển đổi dữ liệu.
	const defaults: Settings = {
		controlsDelay: 2200
	};
	let settings = $state<Settings>(defaults);
	let saved = $state(false);
	async function load() {
		const stored = await chrome.storage.local.get(defaults);
		settings = { ...defaults, ...stored } as Settings;
	}
	// Đây là setting dùng chung của extension; nội dung file phụ đề không bao giờ được lưu ở đây.
	async function save() {
		await chrome.storage.local.set(settings);
		saved = true;
	}
	load();
</script>

<main>
	<h1>Custom PiP settings</h1>
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
