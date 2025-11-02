import { z } from 'astro/zod';

export const artistSchema = z.object({
  id: z.coerce.string(),
  documentId: z.string(),
  name: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  publishedAt: z.coerce.date(),
});

export type Artist = z.infer<typeof artistSchema>;
