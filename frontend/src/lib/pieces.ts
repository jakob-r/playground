export type Piece = {
	slug: string;
	title: string;
	description: string;
	tags: string[];
	thumbnail: string;
};

/** Metadata only. Never import piece implementations here. */
export const pieces: Piece[] = [
	{
		slug: 'fourier-lens',
		title: 'Fourier Lens',
		description:
			'See a picture as a sum of waves. Cut away frequencies and watch what the image keeps: the idea behind JPEG.',
		tags: ['image', 'fourier', 'compression', 'explorable'],
		thumbnail: '/pieces/fourier-lens.svg'
	}
];
