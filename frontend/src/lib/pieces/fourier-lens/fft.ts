// Radix-2 complex FFT. Sizes must be powers of two.

const twiddles = new Map<number, { cos: Float64Array; sin: Float64Array; rev: Uint32Array }>();

function tables(n: number) {
	let t = twiddles.get(n);
	if (t) return t;
	const cos = new Float64Array(n / 2);
	const sin = new Float64Array(n / 2);
	for (let i = 0; i < n / 2; i++) {
		cos[i] = Math.cos((2 * Math.PI * i) / n);
		sin[i] = Math.sin((2 * Math.PI * i) / n);
	}
	const bits = Math.log2(n);
	const rev = new Uint32Array(n);
	for (let i = 0; i < n; i++) {
		let r = 0;
		for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
		rev[i] = r;
	}
	t = { cos, sin, rev };
	twiddles.set(n, t);
	return t;
}

/** In-place 1D FFT. The inverse is scaled by 1/n so that fft → ifft is the identity. */
export function fft(re: Float64Array, im: Float64Array, inverse = false) {
	const n = re.length;
	const { cos, sin, rev } = tables(n);
	for (let i = 0; i < n; i++) {
		const j = rev[i];
		if (j > i) {
			let t = re[i];
			re[i] = re[j];
			re[j] = t;
			t = im[i];
			im[i] = im[j];
			im[j] = t;
		}
	}
	const sign = inverse ? 1 : -1;
	for (let size = 2; size <= n; size *= 2) {
		const half = size / 2;
		const step = n / size;
		for (let start = 0; start < n; start += size) {
			for (let k = 0; k < half; k++) {
				const wr = cos[k * step];
				const wi = sign * sin[k * step];
				const a = start + k;
				const b = a + half;
				const xr = re[b] * wr - im[b] * wi;
				const xi = re[b] * wi + im[b] * wr;
				re[b] = re[a] - xr;
				im[b] = im[a] - xi;
				re[a] += xr;
				im[a] += xi;
			}
		}
	}
	if (inverse) {
		for (let i = 0; i < n; i++) {
			re[i] /= n;
			im[i] /= n;
		}
	}
}

/** Applies a 1D transform to every row, then every column, of an n×n row-major grid. */
export function separable(
	n: number,
	re: Float64Array,
	im: Float64Array,
	line: (re: Float64Array, im: Float64Array) => void
) {
	const lr = new Float64Array(n);
	const li = new Float64Array(n);
	for (let y = 0; y < n; y++) {
		const o = y * n;
		lr.set(re.subarray(o, o + n));
		li.set(im.subarray(o, o + n));
		line(lr, li);
		re.set(lr, o);
		im.set(li, o);
	}
	for (let x = 0; x < n; x++) {
		for (let y = 0; y < n; y++) {
			lr[y] = re[y * n + x];
			li[y] = im[y * n + x];
		}
		line(lr, li);
		for (let y = 0; y < n; y++) {
			re[y * n + x] = lr[y];
			im[y * n + x] = li[y];
		}
	}
}

export function fft2d(n: number, re: Float64Array, im: Float64Array, inverse = false) {
	separable(n, re, im, (r, i) => fft(r, i, inverse));
}
