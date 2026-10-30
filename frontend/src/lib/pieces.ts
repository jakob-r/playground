export type Piece = {
	slug: string;
	title: string;
	description: string;
	tags: string[];
	thumbnail: string;
};

/** Metadata only. Never import piece implementations here. */
export const pieces: Piece[] = [];
