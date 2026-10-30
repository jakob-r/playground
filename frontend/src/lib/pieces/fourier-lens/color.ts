// BT.601 full-range YCbCr, as JPEG uses it. Values stay in 0..255, chroma centred on 128.

export type Space = 'rgb' | 'ycbcr';

export const channelNames: Record<Space, [string, string, string]> = {
	rgb: ['R', 'G', 'B'],
	ycbcr: ['Y', 'Cb', 'Cr']
};

export function fromRgb(space: Space, rgb: Float32Array[]): Float32Array[] {
	if (space === 'rgb') return rgb.map((c) => c.slice());
	const [r, g, b] = rgb;
	const n = r.length;
	const y = new Float32Array(n);
	const cb = new Float32Array(n);
	const cr = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		y[i] = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
		cb[i] = 128 - 0.168736 * r[i] - 0.331264 * g[i] + 0.5 * b[i];
		cr[i] = 128 + 0.5 * r[i] - 0.418688 * g[i] - 0.081312 * b[i];
	}
	return [y, cb, cr];
}

/** Writes channels `ch` of `space` as RGBA pixels into `out`. */
export function toRgba(space: Space, ch: Float32Array[], out: Uint8ClampedArray) {
	const n = ch[0].length;
	for (let i = 0; i < n; i++) {
		let r = ch[0][i];
		let g = ch[1][i];
		let b = ch[2][i];
		if (space === 'ycbcr') {
			const y = r;
			const cb = g - 128;
			const cr = b - 128;
			r = y + 1.402 * cr;
			g = y - 0.344136 * cb - 0.714136 * cr;
			b = y + 1.772 * cb;
		}
		out[4 * i] = r;
		out[4 * i + 1] = g;
		out[4 * i + 2] = b;
		out[4 * i + 3] = 255;
	}
}
