import { defineCollection, z } from 'astro:content';

import { glob } from 'astro/loaders';

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/recipes' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      cover: image(),
      coverAlt: z.string(),
      slug: z.string(),
      publishDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
    }),
});

const records = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/records' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      artist: z.string(),
      giver: z.string().optional(),
      cover: image(),
      dateReceived: z.coerce.date(),
      dateCreated: z.coerce.date().optional(),
    }),
});

export const collections = { recipes, records };
