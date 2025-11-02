import { z } from 'astro/zod';

export const coverArtSchema = z.object({
  id: z.coerce.string(),
  documentId: z.string(),
  name: z.string(),
  alternativeText: z.string().nullable(),
  caption: z.string().nullable(),
  width: z.number(),
  height: z.number(),
  formats: z.object({
    thumbnail: z.object({
      ext: z.string(),
      url: z.string(),
      hash: z.string(),
      mime: z.string(),
      name: z.string(),
      path: z.string().nullable(),
      size: z.number(),
      width: z.number(),
      height: z.number(),
      sizeInBytes: z.number(),
    }),
  }),
  hash: z.string(),
  ext: z.string(),
  mime: z.string(),
  size: z.number(),
  url: z.string(),
  previewUrl: z.string().nullable(),
  provider: z.string(),
  provider_metadata: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string(),
});

export type CoverArt = z.infer<typeof coverArtSchema>;
