import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { strapiLoader } from 'lib/strapiLoader';
import { vinylEntrySchema } from 'interfaces/VinylEntry';
import qs from 'qs';
import type { VinylEntry } from 'interfaces/VinylEntry';

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

const params = { populate: ['artist', 'coverArt'] };

const strapiRecords = defineCollection({
  loader: async () =>
    z
      .array(vinylEntrySchema)
      .parse(
        await strapiLoader<VinylEntry[]>(`/api/records?${qs.stringify(params)}`)
      )
      .sort((recordA, recordB) => {
        let artistA = recordA.artist.name;
        if (artistA.toLocaleLowerCase().startsWith('the ')) {
          artistA = artistA.substring(4);
        }

        let artistB = recordB.artist.name;
        if (artistB.toLocaleLowerCase().startsWith('the ')) {
          artistB = artistB.substring(4);
        }
        return artistA.localeCompare(artistB);
      }),
  schema: vinylEntrySchema,
});

export const collections = {
  recipes,
  strapiRecords,
};
