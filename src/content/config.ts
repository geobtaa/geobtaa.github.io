import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { blogSchema } from 'src/content/BlogSchema';
import { videosSchema } from 'starlight-videos/schemas';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: (context) =>
        blogSchema(context)
          .and(videosSchema)
          .and(
            z.object({
              // Optional 4-digit year; accepts number or string and coerces to number
              year: z.coerce.number().int().min(1800).max(2100).optional(),
              programUpdateLayout: z.boolean().optional(),
              programUpdate: z
                .object({
                  highlight: z
                    .object({
                      title: z.string().optional(),
                      intro: z.string().optional(),
                      bullets: z.array(z.string()).optional(),
                      link: z
                        .object({
                          label: z.string().optional(),
                          url: z.string().optional(),
                        })
                        .optional(),
                      image: z
                        .object({
                          src: z.string().optional(),
                          alt: z.string().optional(),
                          caption: z.string().optional(),
                        })
                        .optional(),
                    })
                    .optional(),
                  committees: z
                    .array(
                      z.object({
                        name: z.string().optional(),
                        updates: z.array(z.string()).optional(),
                      }),
                    )
                    .optional(),
                  workgroups: z
                    .array(
                      z.object({
                        name: z.string().optional(),
                        updates: z.array(z.string()).optional(),
                      }),
                    )
                    .optional(),
                  geoportal: z
                    .object({
                      chart: z
                        .object({
                          image: z.string().optional(),
                          alt: z.string().optional(),
                          caption: z.string().optional(),
                        })
                        .optional(),
                      stats: z
                        .array(
                          z.object({
                            label: z.string().optional(),
                            value: z.string().optional(),
                          }),
                        )
                        .optional(),
                      topGoogleSearches: z.array(z.string()).optional(),
                      topInternalSearches: z.array(z.string()).optional(),
                      moreStats: z
                        .object({
                          label: z.string().optional(),
                          url: z.string().optional(),
                        })
                        .optional(),
                    })
                    .optional(),
                  collections: z
                    .object({
                      totalRecordsLabel: z.string().optional(),
                      totalRecordsValue: z.string().optional(),
                      harvesting: z
                        .array(
                          z.object({
                            title: z.string().optional(),
                            added: z.union([z.string(), z.number()]).optional(),
                            retired: z.union([z.string(), z.number()]).optional(),
                          }),
                        )
                        .optional(),
                    })
                    .optional(),
                  webDevelopment: z
                    .object({
                      highlights: z.array(z.string()).optional(),
                      moreDetails: z
                        .object({
                          label: z.string().optional(),
                          url: z.string().optional(),
                        })
                        .optional(),
                    })
                    .optional(),
                  priorityProjects: z
                    .object({
                      label: z.string().optional(),
                      url: z.string().optional(),
                    })
                    .optional(),
                  additionalNotes: z.string().optional(),
                })
                .optional(),
            }),
          ),
    }),
  }),
};
