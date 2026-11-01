<script lang="ts">
	import { pieces } from '#lib/pieces';

	let query = $state('');
	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return pieces;
		return pieces.filter((p) =>
			[p.title, p.description, ...p.tags].some((s) => s.toLowerCase().includes(q))
		);
	});
</script>

<svelte:head><title>playground.jakob-r.de</title></svelte:head>

<div class="mx-auto max-w-5xl px-6 py-10">
	<h1 class="font-serif text-4xl tracking-tight">Small things to look at.</h1>
	<p class="mt-2 max-w-2xl text-mute">
		A loose collection of little web toys: some explain something, some are just nice to watch. Each
		one runs entirely in your browser, with no backend.
	</p>

	{#if pieces.length}
		<input
			type="search"
			bind:value={query}
			placeholder="Search…"
			aria-label="Search pieces"
			class="mt-6 w-full max-w-md rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
		/>
	{/if}

	<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each shown as piece (piece.slug)}
			<a
				href="/{piece.slug}"
				class="group overflow-hidden rounded-xl border border-line bg-white transition hover:border-accent hover:shadow-md"
			>
				<img src={piece.thumbnail} alt="" class="h-40 w-full bg-accent-soft object-cover" />
				<div class="p-4">
					<h2 class="font-semibold group-hover:text-accent">{piece.title}</h2>
					<p class="mt-1 text-sm text-mute">{piece.description}</p>
					<div class="mt-3 flex flex-wrap gap-1">
						{#each piece.tags as tag}
							<span class="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">{tag}</span>
						{/each}
					</div>
				</div>
			</a>
		{:else}
			<p class="text-mute">
				{pieces.length ? `Nothing matches “${query}”.` : 'Nothing here yet. Soon.'}
			</p>
		{/each}
	</div>

	<footer class="mt-10 border-t border-line pt-6 text-center text-sm text-mute">
		<a href="https://www.jakob-r.de/coding/" class="underline underline-offset-4 hover:text-accent">by jakob-r</a>
	</footer>
</div>
