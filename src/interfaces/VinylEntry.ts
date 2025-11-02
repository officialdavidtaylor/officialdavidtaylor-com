import { z } from 'astro/zod';
import { artistSchema } from './Artist';
import { coverArtSchema } from './CoverArt';

export const vinylEntrySchema = z.object({
  id: z.coerce.string(),
  documentId: z.string(),
  title: z.string(),
  artist: artistSchema,
  coverArt: coverArtSchema,
  giver: z.string().nullable(),
  receivedOn: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  publishedAt: z.coerce.date(),
});

export type VinylEntry = z.infer<typeof vinylEntrySchema>;
