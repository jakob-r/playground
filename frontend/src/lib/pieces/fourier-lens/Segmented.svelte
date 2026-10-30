<script lang="ts" generics="T extends string | number | boolean">
	let {
		value = $bindable(),
		options,
		label,
		onchange
	}: {
		value: T;
		options: { value: T; label: string; disabled?: boolean }[];
		label: string;
		onchange?: (value: T) => void;
	} = $props();
</script>

<div role="radiogroup" aria-label={label} class="inline-flex rounded-md border border-line bg-white p-0.5">
	{#each options as o (String(o.value))}
		<button
			type="button"
			role="radio"
			aria-checked={value === o.value}
			disabled={o.disabled}
			class="rounded px-2 py-0.5 text-xs font-medium transition disabled:opacity-35 {value === o.value
				? 'bg-accent text-white'
				: 'text-mute hover:text-ink'}"
			onclick={() => {
				value = o.value;
				onchange?.(o.value);
			}}>{o.label}</button
		>
	{/each}
</div>
