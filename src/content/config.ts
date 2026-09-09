import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { blogSchema } from 'src/content/BlogSchema';
import { videosSchema } from 'starlight-videos/schemas';

const programUpdateSchema = z.object({
  // Narrative fields now save as Markdown strings. Keep accepting the former
  // string arrays so older entries remain buildable during content migration.
  programUpdate: z
    .object({
      highlight: z
        .object({
          title: z.string().optional(),
          intro: z.string().optional(),
          linkText: z.string().optional(),
          linkUrl: z.string().optional(),
          image: z.string().optional(),
          imageAlt: z.string().optional(),
          imageCaption: z.string().optional(),
        })
        .optional(),
      committees: z
        .object({
          technology: z.union([z.string(), z.array(z.string())]).optional(),
          communityEngagement: z.union([z.string(), z.array(z.string())]).optional(),
          knowledge: z.union([z.string(), z.array(z.string())]).optional(),
          coordination: z.union([z.string(), z.array(z.string())]).optional(),
        })
        .optional(),
      workgroups: z
        .array(
          z.object({
            name: z.string(),
            updates: z.union([z.string(), z.array(z.string())]).optional(),
          }),
        )
        .optional(),
      geoportal: z
        .object({
          chartImage: z.string().optional(),
          chartAlt: z.string().optional(),
          chartCaption: z.string().optional(),
          metrics: z
            .array(
              z.object({
                label: z.string(),
                value: z.string(),
              }),
            )
            .optional(),
          topGoogleSearches: z.array(z.string()).optional(),
          topInternalSearches: z.array(z.string()).optional(),
          recordsTotalAsOf: z.string().optional(),
          recordsTotalValue: z.string().optional(),
        })
        .optional(),
      harvestingActivities: z
        .union([
          z.array(
            z.object({
              title: z.string(),
              recordsAdded: z.string().optional(),
              recordsRetired: z.string().optional(),
            }),
          ),
          z.string(),
        ])
        .optional(),
      webDevelopment: z
        .object({
          updates: z.union([z.string(), z.array(z.string())]).optional(),
          moreDetailsUrl: z.string().optional(),
          moreDetailsLabel: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: (context) =>
        blogSchema(context)
          .and(videosSchema)
          .and(programUpdateSchema)
          .and(
            z.object({
              // Optional 4-digit year; accepts number or string and coerces to number
              year: z.coerce.number().int().min(1800).max(2100).optional(),
              hidePageTitle: z.boolean().optional(),
            }),
          ),
    }),
  }),
};
