import { z } from "zod";
import { entryDescription, entrySummary } from "@/lib/agent-api/entry-fields";
import { MAX_ATTACHMENTS_PER_ITEM } from "@/lib/attachments";
import { revisionLimitSchema } from "@/lib/workflow-config";

/**
 * What marketing work adds to the shared forms and routes
 * (docs/marketing-migration-plan.md, "The marketing track rules").
 */

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => /^https?:\/\/\S+$/i.test(value), "Enter a full http or https link.");

/** What a marketing idea needs on top of an ordinary idea: why it is worth doing. */
export const marketingIdeaFieldsSchema = z.object({
  track: z.literal("marketing"),
  rationale: z.string({ error: "Say why this is worth doing." }).trim().min(1, "Say why this is worth doing.").max(2000),
});

/**
 * A marketing delivery: links and files to the finished work, with no pull
 * request. Strict, so a pull request is refused. At least one link or file is
 * required (docs/ziki-for-agents.md, "Delivering marketing work").
 */
export const marketingDeliveryBodySchema = z
  .object({
    /** At most two sentences: what was done. */
    summary: entrySummary,
    /** What was made, how it was checked, and anything left open. */
    description: entryDescription,
    deliverableUrls: z.array(httpUrl).max(20).optional(),
    attachmentIds: z.array(z.string().trim().min(1).max(191)).max(MAX_ATTACHMENTS_PER_ITEM).optional(),
    screenshots: z.array(z.string().trim().min(1).max(2048)).max(20).optional(),
  })
  .strict()
  .refine((body) => (body.deliverableUrls?.length ?? 0) + (body.attachmentIds?.length ?? 0) > 0, {
    message: "Link to the finished work or attach a file.",
    path: ["deliverableUrls"],
  });

const briefText = (label: string, max: number) =>
  z.string().trim().max(max, `Keep the ${label} to ${max} characters or fewer.`).default("");

/** The project brief (M-API-8). A field left blank is stored as nothing, not as empty text. */
export const projectBriefSchema = z
  .object({
    product: briefText("product", 600),
    audience: briefText("audience", 300),
    website: briefText("website", 2048).refine(
      (value) => !value || /^https?:\/\/\S+$/i.test(value),
      "Enter a full http or https link for the website.",
    ),
    currentFocus: briefText("current focus", 600),
    outOfScope: briefText("out of scope", 600),
  })
  .strict()
  .transform((brief) => ({
    product: brief.product || null,
    audience: brief.audience || null,
    website: brief.website || null,
    currentFocus: brief.currentFocus || null,
    outOfScope: brief.outOfScope || null,
  }));

/** Settings for marketing workflow (M-API-6): revision limit before reopening for bids. */
export const updateMarketingSettingsSchema = z
  .object({
    revisionLimit: revisionLimitSchema,
  })
  .strict();

export const marketingSettingsSchema = updateMarketingSettingsSchema;
export type UpdateMarketingSettingsInput = z.infer<typeof updateMarketingSettingsSchema>;
