<script lang="ts">
	import InfoHint from '#lib/core/InfoHint.svelte';
	import { channelNames, type Space } from './color';
	import { origin, type MaskOp, type Transform } from './masks';
	import PanZoomCanvas, { type Ring, type StrokePhase } from './PanZoomCanvas.svelte';
	import Segmented from './Segmented.svelte';
	import sampleUrl from './sample.webp';
	import { N, type FromWorker, type ToWorker, type View } from './types';

	let transform = $state<Transform>('fft');
	let space = $state<Space>('ycbcr');
	let channel = $state(-1);
	let display = $state<View['display']>('magnitude');
	let original = $state(false);

	let tool = $state<'circle' | 'brush' | 'hand'>('circle');
	let keepInside = $state(true);
	let brushKeep = $state(false);
	let brushSize = $state(6);
	let keepPct = $state(100);
	let keepBy = $state<'lowest' | 'strongest'>('strongest');

	let kept = $state(1);
	let psnr = $state(Infinity);
	let version = $state(0);
	let loading = $state(true);
	let dragging = $state(false);
	let hover = $state<[number, number] | null>(null);
	let circleR = $state<number | null>(null);

	const imageCanvas = frame();
	const spectrumCanvas = frame();
	let worker: Worker | undefined;
	let fileInput: HTMLInputElement;

	function frame() {
		const c = document.createElement('canvas');
		c.width = c.height = N;
		return c;
	}

	function send(m: ToWorker) {
		worker?.postMessage(m);
	}

	const targets = () => (channel < 0 ? [0, 1, 2] : [channel]);
	const edit = (op: MaskOp) => send({ type: 'mask', op, channels: targets() });

	$effect(() => {
		const w = new Worker(new URL('./transform.worker.ts', import.meta.url), { type: 'module' });
		w.onmessage = (e: MessageEvent<FromWorker>) => {
			const m = e.data;
			imageCanvas.getContext('2d')!.putImageData(new ImageData(m.spatial as ImageDataArray, N, N), 0, 0);
			spectrumCanvas.getContext('2d')!.putImageData(new ImageData(m.spectrum as ImageDataArray, N, N), 0, 0);
			kept = m.kept;
			psnr = m.psnr;
			loading = false;
			version++;
		};
		worker = w;
		fetch(sampleUrl)
			.then((r) => r.blob())
			.then(load);
		return () => w.terminate();
	});

	$effect(() => {
		const view: View = { transform, space, channel, display, original };
		send({ type: 'view', view });
	});

	async function load(blob: Blob) {
		loading = true;
		const bmp = await createImageBitmap(blob);
		const side = Math.min(bmp.width, bmp.height);
		const ctx = frame().getContext('2d', { willReadFrequently: true })!;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, N, N);
		bmp.close();
		keepPct = 100;
		send({ type: 'image', rgba: ctx.getImageData(0, 0, N, N).data });
	}

	function pick(files: FileList | null | undefined) {
		const f = files?.[0];
		if (f?.type.startsWith('image/')) load(f).catch(() => (loading = false));
	}

	let last: [number, number] = [0, 0];
	function stroke(phase: StrokePhase, x: number, y: number) {
		if (tool === 'circle') {
			if (phase === 'end') {
				circleR = null;
				return;
			}
			const [ox, oy] = origin(transform, N);
			circleR = Math.hypot(x - ox, y - oy);
			edit({ kind: 'circle', r: circleR, keepInside });
		} else if (tool === 'brush' && phase !== 'end') {
			const points: [number, number][] = phase === 'start' ? [[x, y]] : [last, [x, y]];
			last = [x, y];
			edit({ kind: 'brush', points, r: brushSize, keep: brushKeep });
		}
	}

	const applyKeep = () => edit({ kind: keepBy, pct: keepPct });

	function reset() {
		keepPct = 100;
		send({ type: 'mask', op: { kind: 'reset' }, channels: [0, 1, 2] });
	}

	const rings = $derived.by((): Ring[] => {
		const [ox, oy] = origin(transform, N);
		if (tool === 'circle' && circleR !== null) return [{ x: ox, y: oy, r: circleR }];
		if (tool === 'brush' && hover) {
			const [x, y] = hover;
			const r: Ring[] = [{ x, y, r: brushSize }];
			if (transform === 'fft') r.push({ x: N - x, y: N - y, r: brushSize, dashed: true });
			return r;
		}
		return [];
	});

	const names = $derived(channelNames[space]);
	const channelOptions = $derived([
		{ value: -1, label: 'All' },
		...names.map((label, value) => ({ value, label }))
	]);
	const target = $derived(channel < 0 ? 'all channels' : names[channel]);
</script>

<svelte:window onpointerup={() => (original = false)} />

<div
	role="region"
	aria-label="Fourier Lens"
	class="relative flex flex-col md:h-full"
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={(e) => e.currentTarget === e.target && (dragging = false)}
	ondrop={(e) => {
		e.preventDefault();
		dragging = false;
		pick(e.dataTransfer?.files);
	}}
>
	<div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-4 py-2 text-xs">
		<h1 class="font-serif text-lg tracking-tight">Fourier Lens</h1>
		<span class="flex items-center gap-1.5">
			<Segmented
				label="Transform"
				bind:value={transform}
				options={[
					{ value: 'fft', label: 'FFT' },
					{ value: 'dct', label: 'DCT' }
				]}
			/>
			<InfoHint
				text="FFT: complex coefficients; the image is treated as if it tiled the plane, and after shifting the lowest frequencies sit in the centre. DCT: real coefficients, no wrap-around seams, lowest frequencies in the top-left corner. JPEG uses the DCT, on 8×8 blocks rather than the whole image."
			/>
		</span>
		<span class="flex items-center gap-1.5">
			<Segmented
				label="Colour space"
				bind:value={space}
				options={[
					{ value: 'rgb', label: 'RGB' },
					{ value: 'ycbcr', label: 'YCbCr' }
				]}
			/>
			<Segmented label="Channel" bind:value={channel} options={channelOptions} />
			<InfoHint
				text="Y is brightness, Cb and Cr are colour differences. Eyes barely notice fine colour detail, so JPEG keeps Y sharp and drops most chroma frequencies. Try it: pick Cb, cut a small circle, do the same for Cr, then view All."
			/>
		</span>
		<span class="flex items-center gap-1.5">
			<Segmented
				label="Spectrum display"
				bind:value={display}
				options={[
					{ value: 'magnitude', label: 'Magnitude' },
					{ value: 'phase', label: transform === 'fft' ? 'Phase' : 'Sign' }
				]}
			/>
			<InfoHint
				text="Magnitude (log scale) says how much of each frequency there is; it spans six orders of magnitude, so a linear scale would show one bright dot. Phase says where the waves line up. It looks like noise but carries most of the structure. DCT coefficients are real, so their only phase is a sign."
			/>
		</span>
		<span class="ml-auto flex items-center gap-2">
			<button
				type="button"
				class="rounded-md border border-line bg-white px-2 py-1 font-medium hover:border-accent hover:text-accent"
				onclick={() => fileInput.click()}>Load image…</button
			>
			<button
				type="button"
				class="rounded-md border border-line bg-white px-2 py-1 font-medium hover:border-accent hover:text-accent"
				onclick={reset}>Reset</button
			>
			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				class="hidden"
				onchange={(e) => pick(e.currentTarget.files)}
			/>
		</span>
	</div>

	<div class="grid gap-px bg-line md:min-h-0 md:flex-1 md:grid-cols-2">
		<section class="flex min-w-0 flex-col bg-paper">
			<header class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs">
				<h2 class="font-semibold">Image</h2>
				<span class="text-mute">rebuilt from the kept coefficients</span>
				<span class="ml-auto flex items-center gap-2">
					<span class="text-mute tabular-nums">
						{Number.isFinite(psnr) ? `PSNR ${psnr.toFixed(1)} dB` : 'identical'}
					</span>
					<InfoHint
						text="Peak signal-to-noise ratio of the rebuilt image against the original, over all channels. Above about 35 dB the difference is hard to see."
					/>
					<button
						type="button"
						class="rounded-md border border-line bg-white px-2 py-1 font-medium select-none hover:border-accent hover:text-accent"
						class:border-accent={original}
						onpointerdown={() => (original = true)}
						onkeydown={(e) => e.key === ' ' && (original = true)}
						onkeyup={() => (original = false)}>Hold for original</button
					>
				</span>
			</header>
			<div class="relative aspect-square bg-[#16130f] md:aspect-auto md:min-h-0 md:flex-1">
				<PanZoomCanvas source={imageCanvas} {version} label="Rebuilt image" />
				{#if loading}
					<p class="absolute inset-0 grid place-items-center text-sm text-white/60">Transforming…</p>
				{/if}
			</div>
		</section>

		<section class="flex min-w-0 flex-col bg-paper">
			<header class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs">
				<h2 class="font-semibold">Frequencies</h2>
				<Segmented
					label="Tool"
					bind:value={tool}
					options={[
						{ value: 'circle', label: 'Circle' },
						{ value: 'brush', label: 'Brush' },
						{ value: 'hand', label: 'Pan' }
					]}
				/>
				{#if tool === 'circle'}
					<Segmented
						label="Circle mode"
						bind:value={keepInside}
						options={[
							{ value: true, label: 'Keep inside' },
							{ value: false, label: 'Cut inside' }
						]}
					/>
				{:else if tool === 'brush'}
					<Segmented
						label="Brush mode"
						bind:value={brushKeep}
						options={[
							{ value: false, label: 'Erase' },
							{ value: true, label: 'Restore' }
						]}
					/>
					<label class="flex items-center gap-1.5 text-mute">
						size
						<input type="range" min="1" max="40" bind:value={brushSize} class="w-20 accent-accent" />
					</label>
					{#if transform === 'fft'}
						<InfoHint
							text="A real image has a symmetric FFT: every frequency appears twice, mirrored through the centre. The brush paints both (dashed ring) so the result stays a real image."
						/>
					{/if}
				{/if}
				<span class="ml-auto text-mute tabular-nums">
					{(kept * 100).toFixed(kept < 0.1 ? 1 : 0)} % kept · {target}
				</span>
			</header>
			<div class="relative aspect-square bg-[#16130f] md:aspect-auto md:min-h-0 md:flex-1">
				<PanZoomCanvas
					source={spectrumCanvas}
					{version}
					pan={tool === 'hand'}
					{rings}
					label="Frequency spectrum, editable"
					onstroke={stroke}
					onhover={(p) => (hover = p)}
				/>
				<p
					class="pointer-events-none absolute bottom-2 left-3 rounded bg-black/45 px-1.5 py-0.5 text-[11px] text-white/80"
				>
					{transform === 'fft'
						? 'centre = low frequencies · edges = high'
						: 'top-left = low frequencies · bottom-right = high'}
				</p>
			</div>
			<footer class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 py-2 text-xs">
				<label class="flex min-w-48 flex-1 items-center gap-2">
					<span class="font-medium whitespace-nowrap">Keep {keepPct} %</span>
					<input
						type="range"
						min="0"
						max="100"
						step="0.5"
						bind:value={keepPct}
						oninput={applyKeep}
						class="w-full accent-accent"
					/>
				</label>
				<span class="flex items-center gap-1.5">
					<Segmented
						label="Which coefficients to keep"
						bind:value={keepBy}
						onchange={applyKeep}
						options={[
							{ value: 'strongest', label: 'strongest' },
							{ value: 'lowest', label: 'lowest' }
						]}
					/>
					<InfoHint
						text="Lowest keeps the frequencies nearest to DC, which is a blur. Strongest keeps the largest coefficients wherever they are, closer to how compression decides. Real codecs then also quantise: they store kept values coarsely instead of exactly."
					/>
				</span>
			</footer>
		</section>
	</div>

	{#if dragging}
		<div
			class="pointer-events-none absolute inset-0 grid place-items-center border-4 border-dashed border-accent bg-paper/70 font-serif text-2xl"
		>
			Drop an image. It stays in your browser.
		</div>
	{/if}
</div>
