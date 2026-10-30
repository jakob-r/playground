// Coefficient masks, stored in display coordinates: 1 keeps a coefficient, 0 drops it.
// FFT display is fftshifted (DC in the centre); DCT display has DC in the top-left corner.

export type Transform = 'fft' | 'dct';

export type MaskOp =
	| { kind: 'reset' }
	| { kind: 'circle'; r: number; keepInside: boolean }
	| { kind: 'brush'; points: [number, number][]; r: number; keep: boolean }
	| { kind: 'lowest'; pct: number }
	| { kind: 'strongest'; pct: number };

/** Display position of the DC coefficient. */
export function origin(t: Transform, n: number): [number, number] {
	return t === 'fft' ? [n / 2, n / 2] : [0, 0];
}

const orders = new Map<string, Uint32Array>();

/** Display indices sorted by distance from DC, lowest frequency first. */
export function lowFirst(t: Transform, n: number) {
	const key = `${t}${n}`;
	let order = orders.get(key);
	if (order) return order;
	const [ox, oy] = origin(t, n);
	const d = new Float64Array(n * n);
	for (let y = 0; y < n; y++)
		for (let x = 0; x < n; x++) d[y * n + x] = (x - ox) ** 2 + (y - oy) ** 2;
	order = Uint32Array.from(d.keys()).sort((a, b) => d[a] - d[b]);
	orders.set(key, order);
	return order;
}

export function circle(mask: Uint8Array, t: Transform, n: number, r: number, keepInside: boolean) {
	const [ox, oy] = origin(t, n);
	const r2 = r * r;
	for (let y = 0; y < n; y++)
		for (let x = 0; x < n; x++) {
			const inside = (x - ox) ** 2 + (y - oy) ** 2 <= r2;
			mask[y * n + x] = inside === keepInside ? 1 : 0;
		}
}

function stamp(mask: Uint8Array, n: number, cx: number, cy: number, r: number, v: number) {
	const x0 = Math.max(0, Math.floor(cx - r));
	const x1 = Math.min(n - 1, Math.ceil(cx + r));
	const y0 = Math.max(0, Math.floor(cy - r));
	const y1 = Math.min(n - 1, Math.ceil(cy + r));
	const r2 = r * r;
	for (let y = y0; y <= y1; y++)
		for (let x = x0; x <= x1; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) mask[y * n + x] = v;
}

/**
 * Paints a stroke through `points`. A real image has a point-symmetric FFT (F(−k) = conj F(k)),
 * so FFT strokes are mirrored about DC to keep the inverse real.
 */
export function brush(
	mask: Uint8Array,
	t: Transform,
	n: number,
	points: [number, number][],
	r: number,
	keep: boolean
) {
	const v = keep ? 1 : 0;
	const step = Math.max(0.5, r / 2);
	const paint = (x: number, y: number) => {
		stamp(mask, n, x, y, r, v);
		if (t === 'fft') stamp(mask, n, n - x, n - y, r, v);
	};
	paint(...points[0]);
	for (let i = 1; i < points.length; i++) {
		const [ax, ay] = points[i - 1];
		const [bx, by] = points[i];
		const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / step);
		for (let s = 1; s <= steps; s++) paint(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps);
	}
}

export function lowest(mask: Uint8Array, t: Transform, n: number, pct: number) {
	const order = lowFirst(t, n);
	const k = Math.round((pct / 100) * order.length);
	mask.fill(0);
	for (let i = 0; i < k; i++) mask[order[i]] = 1;
}

/** Keeps the `pct` % largest coefficients. `sorted` holds the magnitudes in ascending order. */
export function strongest(mask: Uint8Array, mag: Float32Array, sorted: Float32Array, pct: number) {
	const k = Math.round((pct / 100) * mag.length);
	if (k === 0) {
		mask.fill(0);
		return;
	}
	const threshold = sorted[mag.length - k];
	for (let i = 0; i < mag.length; i++) mask[i] = mag[i] >= threshold ? 1 : 0;
}
