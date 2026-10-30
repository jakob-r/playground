// Orthonormal DCT-II and its inverse (DCT-III), each computed with one FFT (Makhoul 1980).
import { fft, separable } from './fft';

const cache = new Map<number, { c: Float64Array; s: Float64Array; vr: Float64Array; vi: Float64Array }>();

function tables(n: number) {
	let t = cache.get(n);
	if (t) return t;
	const c = new Float64Array(n);
	const s = new Float64Array(n);
	for (let k = 0; k < n; k++) {
		c[k] = Math.cos((Math.PI * k) / (2 * n));
		s[k] = Math.sin((Math.PI * k) / (2 * n));
	}
	t = { c, s, vr: new Float64Array(n), vi: new Float64Array(n) };
	cache.set(n, t);
	return t;
}

/** In-place orthonormal DCT-II of `x`. */
export function dct(x: Float64Array) {
	const n = x.length;
	const { c, s, vr, vi } = tables(n);
	for (let k = 0; k < n / 2; k++) {
		vr[k] = x[2 * k];
		vr[n - 1 - k] = x[2 * k + 1];
	}
	vi.fill(0);
	fft(vr, vi);
	const a0 = Math.sqrt(1 / n);
	const ak = Math.sqrt(2 / n);
	for (let k = 0; k < n; k++) {
		// Re(e^{-iπk/2n} · V[k])
		x[k] = (vr[k] * c[k] + vi[k] * s[k]) * (k === 0 ? a0 : ak);
	}
}

/** In-place inverse of `dct`. */
export function idct(x: Float64Array) {
	const n = x.length;
	const { c, s, vr, vi } = tables(n);
	const a0 = Math.sqrt(1 / n);
	const ak = Math.sqrt(2 / n);
	// Undo the scaling, rebuild W[k] = X[k] − i·X[n−k], then V[k] = e^{iπk/2n} · W[k].
	for (let k = 0; k < n; k++) {
		const wr = x[k] / (k === 0 ? a0 : ak);
		const wi = k === 0 ? 0 : -x[n - k] / ak;
		vr[k] = wr * c[k] - wi * s[k];
		vi[k] = wr * s[k] + wi * c[k];
	}
	fft(vr, vi, true);
	for (let k = 0; k < n / 2; k++) {
		x[2 * k] = vr[k];
		x[2 * k + 1] = vr[n - 1 - k];
	}
}

export function dct2d(n: number, x: Float64Array, inverse = false) {
	// `separable` carries an imaginary plane along; the DCT ignores it.
	const scratch = new Float64Array(n * n);
	separable(n, x, scratch, (r) => (inverse ? idct(r) : dct(r)));
}
