// Owns the image, its spectra and the masks. The main thread only sends settings and edits
// and receives two finished RGBA frames (image and spectrum).
import { fromRgb, toRgba, type Space } from './color';
import { dct2d } from './dct';
import { fft2d } from './fft';
import * as masks from './masks';
import type { MaskOp, Transform } from './masks';
import { N, type FromWorker, type ToWorker, type View } from './types';

const NN = N * N;

type Spectrum = {
	/** Display coordinates. For the DCT `re` holds the coefficients and `im` is null. */
	re: Float32Array;
	im: Float32Array | null;
	/** log(1 + |coefficient|), display coordinates. */
	mag: Float32Array;
	lo: number;
	hi: number;
	sorted?: Float32Array;
};

type Slot = { spectra: Spectrum[]; masks: Uint8Array[]; recon: (Float32Array | null)[] };

let rgb: Float32Array[] | null = null;
let view: View | null = null;
const channels = new Map<Space, Float32Array[]>();
const slots = new Map<string, Slot>();

/** Display index ↔ FFT index. fftshift is its own inverse for even N. */
function shift(i: number) {
	const x = i % N;
	const y = (i - x) / N;
	return ((y + N / 2) % N) * N + ((x + N / 2) % N);
}

function percentile(a: Float32Array, p: number) {
	const sample = new Float32Array(4096);
	for (let i = 0; i < sample.length; i++) sample[i] = a[(i * 2654435761) % a.length];
	sample.sort();
	return sample[Math.min(sample.length - 1, Math.floor(p * sample.length))];
}

function forward(t: Transform, src: Float32Array): Spectrum {
	const re64 = Float64Array.from(src);
	let re: Float32Array;
	let im: Float32Array | null = null;
	if (t === 'fft') {
		const im64 = new Float64Array(NN);
		fft2d(N, re64, im64);
		re = new Float32Array(NN);
		im = new Float32Array(NN);
		for (let i = 0; i < NN; i++) {
			const j = shift(i);
			re[i] = re64[j];
			im[i] = im64[j];
		}
	} else {
		dct2d(N, re64);
		re = Float32Array.from(re64);
	}
	const mag = new Float32Array(NN);
	for (let i = 0; i < NN; i++) mag[i] = Math.log1p(im ? Math.hypot(re[i], im[i]) : Math.abs(re[i]));
	return { re, im, mag, lo: percentile(mag, 0.05), hi: percentile(mag, 0.9995) };
}

function inverse(t: Transform, s: Spectrum, mask: Uint8Array): Float32Array {
	const re64 = new Float64Array(NN);
	if (t === 'fft') {
		const im64 = new Float64Array(NN);
		for (let i = 0; i < NN; i++) {
			if (!mask[i]) continue;
			const j = shift(i);
			re64[j] = s.re[i];
			im64[j] = s.im![i];
		}
		fft2d(N, re64, im64, true);
	} else {
		for (let i = 0; i < NN; i++) if (mask[i]) re64[i] = s.re[i];
		dct2d(N, re64, true);
	}
	return Float32Array.from(re64);
}

function chans(space: Space) {
	let c = channels.get(space);
	if (!c) channels.set(space, (c = fromRgb(space, rgb!)));
	return c;
}

function slot(t: Transform, space: Space): Slot {
	const key = `${t}-${space}`;
	let s = slots.get(key);
	if (!s) {
		const src = chans(space);
		s = {
			spectra: src.map((c) => forward(t, c)),
			masks: src.map(() => new Uint8Array(NN).fill(1)),
			recon: src.map((c) => c)
		};
		slots.set(key, s);
	}
	return s;
}

function applyMask(op: MaskOp, which: number[]) {
	const { transform: t, space } = view!;
	const s = slot(t, space);
	for (const c of which) {
		const m = s.masks[c];
		const spec = s.spectra[c];
		if (op.kind === 'reset') m.fill(1);
		else if (op.kind === 'circle') masks.circle(m, t, N, op.r, op.keepInside);
		else if (op.kind === 'brush') masks.brush(m, t, N, op.points, op.r, op.keep);
		else if (op.kind === 'lowest') masks.lowest(m, t, N, op.pct);
		else {
			spec.sorted ??= spec.mag.slice().sort();
			masks.strongest(m, spec.mag, spec.sorted, op.pct);
		}
		s.recon[c] = null;
	}
}

const tint = [34, 13, 8];

function hue(h: number, out: Uint8ClampedArray, o: number) {
	// Cyclic, soft colour wheel for phase in [0, 1).
	for (let k = 0; k < 3; k++) {
		const v = 0.5 + 0.5 * Math.cos(2 * Math.PI * (h - k / 3));
		out[o + k] = 60 + 170 * v;
	}
}

function render() {
	if (!rgb || !view) return;
	const { transform: t, space, channel, display, original } = view;
	const s = slot(t, space);
	const src = chans(space);
	s.recon.forEach((r, c) => r || (s.recon[c] = inverse(t, s.spectra[c], s.masks[c])));

	const full = new Uint8ClampedArray(NN * 4);
	toRgba(space, s.recon as Float32Array[], full);
	let se = 0;
	for (let i = 0; i < NN; i++)
		for (let k = 0; k < 3; k++) se += (full[4 * i + k] - Math.min(255, Math.max(0, rgb[k][i]))) ** 2;
	const psnr = 10 * Math.log10((255 * 255) / (se / (NN * 3)));

	const shown = channel < 0 ? [0, 1, 2] : [channel];
	const pick = original ? src : (s.recon as Float32Array[]);
	let spatial = full;
	if (original || channel >= 0) {
		spatial = new Uint8ClampedArray(NN * 4);
		if (channel < 0) toRgba(space, pick, spatial);
		else
			for (let i = 0; i < NN; i++) {
				const v = pick[channel][i];
				spatial[4 * i] = spatial[4 * i + 1] = spatial[4 * i + 2] = v;
				spatial[4 * i + 3] = 255;
			}
	}

	const spectrum = new Uint8ClampedArray(NN * 4);
	const norm = (c: number, i: number) => {
		const sp = s.spectra[c];
		return Math.min(1, Math.max(0, (sp.mag[i] - sp.lo) / (sp.hi - sp.lo)));
	};
	let kept = 0;
	for (let i = 0; i < NN; i++) {
		const o = 4 * i;
		if (display === 'phase') {
			const sp = s.spectra[shown[0]];
			if (sp.im) hue((Math.atan2(sp.im[i], sp.re[i]) + Math.PI) / (2 * Math.PI), spectrum, o);
			else {
				// DCT coefficients are real: the only "phase" is the sign.
				const v = 255 * norm(shown[0], i);
				const pos = sp.re[i] >= 0;
				spectrum[o] = pos ? v : v * 0.35;
				spectrum[o + 1] = v * 0.55;
				spectrum[o + 2] = pos ? v * 0.35 : v;
			}
		} else if (channel < 0 && space === 'rgb') {
			for (let k = 0; k < 3; k++) spectrum[o + k] = 255 * norm(k, i);
		} else {
			let v = 0;
			for (const c of shown) v += norm(c, i);
			spectrum[o] = spectrum[o + 1] = spectrum[o + 2] = (255 * v) / shown.length;
		}
		let f = 0;
		for (const c of shown) f += s.masks[c][i];
		f /= shown.length;
		kept += f;
		if (f < 1)
			for (let k = 0; k < 3; k++)
				spectrum[o + k] = f * spectrum[o + k] + (1 - f) * (spectrum[o + k] * 0.25 + tint[k]);
		spectrum[o + 3] = 255;
	}

	const msg: FromWorker = { type: 'frame', spatial, spectrum, kept: kept / NN, psnr };
	postMessage(msg, { transfer: [spatial.buffer, spectrum.buffer] });
}

// Edits arrive faster than frames can be computed while brushing: coalesce to one render.
let scheduled = false;
function schedule() {
	if (scheduled) return;
	scheduled = true;
	setTimeout(() => {
		scheduled = false;
		render();
	}, 0);
}

onmessage = (e: MessageEvent<ToWorker>) => {
	const m = e.data;
	if (m.type === 'image') {
		rgb = [0, 1, 2].map((k) => {
			const c = new Float32Array(NN);
			for (let i = 0; i < NN; i++) c[i] = m.rgba[4 * i + k];
			return c;
		});
		channels.clear();
		slots.clear();
	} else if (m.type === 'view') view = m.view;
	else if (view && rgb) applyMask(m.op, m.channels);
	schedule();
};
