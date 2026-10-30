import type { Space } from './color';
import type { MaskOp, Transform } from './masks';

/** Working size: images are cropped and scaled to N×N. A power of two for the radix-2 FFT. */
export const N = 512;
export type View = {
	transform: Transform;
	space: Space;
	/** −1 shows all channels combined. */
	channel: number;
	display: 'magnitude' | 'phase';
	original: boolean;
};

export type ToWorker =
	| { type: 'image'; rgba: Uint8ClampedArray }
	| { type: 'view'; view: View }
	| { type: 'mask'; op: MaskOp; channels: number[] };

export type FromWorker = {
	type: 'frame';
	spatial: Uint8ClampedArray;
	spectrum: Uint8ClampedArray;
	/** Fraction of coefficients kept in the shown channels. */
	kept: number;
	/** PSNR of the full reconstruction against the original, in dB (Infinity when identical). */
	psnr: number;
};
