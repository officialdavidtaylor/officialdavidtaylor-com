import { defineLiveCollection, z } from 'astro:content';

import { recordsLoader } from 'lib/server/records';

const records = defineLiveCollection({
  loader: recordsLoader(),
  schema: z.object({
    artistName: z.string(),
    coverUrl: z.string().url(),
    giver: z.string().nullable(),
    receivedOn: z.coerce.date(),
    slug: z.string(),
    title: z.string(),
  }),
});

export const collections = {
  records,
};
