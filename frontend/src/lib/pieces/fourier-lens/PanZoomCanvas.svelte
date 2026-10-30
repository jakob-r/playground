<script lang="ts" module>
	/** A circle in image coordinates, drawn on top of the image. */
	export type Ring = { x: number; y: number; r: number; dashed?: boolean };
	export type StrokePhase = 'start' | 'move' | 'end';
</script>

<script lang="ts">
	let {
		source,
		version,
		pan = false,
		rings = [],
		label,
		onstroke,
		onhover
	}: {
		/** Square N×N canvas holding the current frame. */
		source: HTMLCanvasElement;
		/** Bump to redraw after `source` changed. */
		version: number;
		/** When set, a single pointer pans instead of calling `onstroke`. */
		pan?: boolean;
		rings?: Ring[];
		label: string;
		onstroke?: (phase: StrokePhase, x: number, y: number) => void;
		onhover?: (p: [number, number] | null) => void;
	} = $props();

	let canvas: HTMLCanvasElement;
	let w = $state(0);
	let h = $state(0);
	// Screen position of image pixel (x, y): (x·s + tx, y·s + ty), in CSS pixels.
	let s = $state(1);
	let tx = $state(0);
	let ty = $state(0);
	let fitted = false;

	const fitScale = () => Math.min(w, h) / source.width;

	function fit() {
		s = fitScale();
		tx = (w - source.width * s) / 2;
		ty = (h - source.height * s) / 2;
	}

	function zoomAt(px: number, py: number, factor: number) {
		const f = fitScale();
		const next = Math.min(f * 64, Math.max(f * 0.5, s * factor));
		tx = px - ((px - tx) * next) / s;
		ty = py - ((py - ty) * next) / s;
		s = next;
	}

	const toImage = (px: number, py: number): [number, number] => [(px - tx) / s, (py - ty) / s];

	function local(e: PointerEvent | WheelEvent): [number, number] {
		const r = canvas.getBoundingClientRect();
		return [e.clientX - r.left, e.clientY - r.top];
	}

	$effect(() => {
		const ro = new ResizeObserver(([entry]) => {
			w = entry.contentRect.width;
			h = entry.contentRect.height;
			if (!fitted && w && h) {
				fit();
				fitted = true;
			}
		});
		ro.observe(canvas);
		// Wheel must be non-passive to stop the page from scrolling.
		const wheel = (e: WheelEvent) => {
			e.preventDefault();
			const [px, py] = local(e);
			zoomAt(px, py, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
		};
		canvas.addEventListener('wheel', wheel, { passive: false });
		return () => {
			ro.disconnect();
			canvas.removeEventListener('wheel', wheel);
		};
	});

	$effect(() => {
		void version;
		const dpr = devicePixelRatio || 1;
		const cw = Math.round(w * dpr);
		const ch = Math.round(h * dpr);
		if (canvas.width !== cw || canvas.height !== ch) {
			canvas.width = cw;
			canvas.height = ch;
		}
		const ctx = canvas.getContext('2d')!;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		// Show individual pixels / coefficients once zoomed in.
		ctx.imageSmoothingEnabled = s < 2;
		ctx.drawImage(source, tx, ty, source.width * s, source.height * s);
		for (const ring of rings) {
			ctx.beginPath();
			ctx.arc(ring.x * s + tx, ring.y * s + ty, Math.max(1, ring.r * s), 0, 2 * Math.PI);
			ctx.setLineDash(ring.dashed ? [4, 4] : []);
			ctx.lineWidth = 3;
			ctx.strokeStyle = 'rgba(0,0,0,0.5)';
			ctx.stroke();
			ctx.lineWidth = 1.5;
			ctx.strokeStyle = '#fff';
			ctx.stroke();
		}
	});

	const pointers = new Map<number, [number, number]>();
	let mode: 'none' | 'pan' | 'tool' | 'pinch' = 'none';
	let pinch = { d: 0, mx: 0, my: 0 };
	let spaceHeld = false;

	function pinchState() {
		const [[ax, ay], [bx, by]] = [...pointers.values()];
		return { d: Math.hypot(bx - ax, by - ay), mx: (ax + bx) / 2, my: (ay + by) / 2 };
	}

	function down(e: PointerEvent) {
		try {
			canvas.setPointerCapture(e.pointerId);
		} catch {
			// Synthetic events have no active pointer to capture; dragging still works without it.
		}
		const p = local(e);
		pointers.set(e.pointerId, p);
		if (pointers.size === 2) {
			if (mode === 'tool') onstroke?.('end', ...toImage(...p));
			mode = 'pinch';
			pinch = pinchState();
		} else if (pointers.size === 1) {
			if (pan || !onstroke || e.button === 1 || spaceHeld) mode = 'pan';
			else {
				mode = 'tool';
				onstroke('start', ...toImage(...p));
			}
		}
	}

	function move(e: PointerEvent) {
		const p = local(e);
		if (e.pointerType !== 'touch') onhover?.(toImage(...p));
		const prev = pointers.get(e.pointerId);
		if (!prev) return;
		pointers.set(e.pointerId, p);
		if (mode === 'pan') {
			tx += p[0] - prev[0];
			ty += p[1] - prev[1];
		} else if (mode === 'pinch' && pointers.size === 2) {
			const next = pinchState();
			tx += next.mx - pinch.mx;
			ty += next.my - pinch.my;
			if (pinch.d > 0) zoomAt(next.mx, next.my, next.d / pinch.d);
			pinch = next;
		} else if (mode === 'tool') onstroke?.('move', ...toImage(...p));
	}

	function up(e: PointerEvent) {
		if (!pointers.delete(e.pointerId)) return;
		if (mode === 'tool') onstroke?.('end', ...toImage(...local(e)));
		mode = pointers.size === 1 ? 'pan' : 'none';
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
			spaceHeld = true;
			if (e.target === document.body || e.target === canvas) e.preventDefault();
		}
	}}
	onkeyup={(e) => e.code === 'Space' && (spaceHeld = false)}
/>

<canvas
	bind:this={canvas}
	aria-label={label}
	class="block size-full touch-none select-none"
	class:cursor-grab={pan || !onstroke}
	class:cursor-crosshair={!pan && onstroke}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	onpointerleave={() => onhover?.(null)}
	ondblclick={fit}
></canvas>
