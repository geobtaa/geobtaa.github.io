import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { blogSchema } from 'src/content/BlogSchema';
import { videosSchema } from 'starlight-videos/schemas';

const programUpdateSchema = z.object({
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
          technology: z.array(z.string()).optional(),
          communityEngagement: z.array(z.string()).optional(),
          knowledge: z.array(z.string()).optional(),
          coordination: z.array(z.string()).optional(),
        })
        .optional(),
      workgroups: z
        .array(
          z.object({
            name: z.string(),
            updates: z.array(z.string()).optional(),
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
          moreStatsUrl: z.string().optional(),
          moreStatsLabel: z.string().optional(),
        })
        .optional(),
      harvestingActivities: z
        .array(
          z.object({
            title: z.string(),
            recordsAdded: z.string().optional(),
            recordsRetired: z.string().optional(),
          }),
        )
        .optional(),
      webDevelopment: z
        .object({
          updates: z.array(z.string()).optional(),
          moreDetailsUrl: z.string().optional(),
          moreDetailsLabel: z.string().optional(),
        })
        .optional(),
      priorityProjects: z
        .object({
          url: z.string().optional(),
          label: z.string().optional(),
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
