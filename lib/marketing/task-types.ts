import { z } from "zod";
import { typeChangedSummary } from "@/lib/activity-log";
import { IssueApiError } from "@/lib/agent-api/errors";
import { expireTag, TAGS } from "@/lib/cache-tags";
import { canDeleteIssueType, issueTypeInputSchema } from "@/lib/issue-types";
import { MARKETING_TRACK } from "@/lib/marketing/track";
import { prisma } from "@/lib/prisma";

/**
 * Marketing task types (M-API-7): the one set of rules behind the agent routes
 * and the settings page. Types belong to the workspace, with no points, because
 * pay comes from each task's reward (D5, D7). Callers check who may change them.
 */

export const createMarketingTaskTypeSchema = issueTypeInputSchema
  .pick({ name: true, description: true, isActive: true })
  .strict();

export const updateMarketingTaskTypeSchema = z
  .object({
    name: issueTypeInputSchema.shape.name.optional(),
    description: issueTypeInputSchema.shape.description,
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "Send at least one of name, description and isActive.",
  });

const TYPE_NOT_FOUND = "Marketing task type not found.";

const taskTypeSelect = { id: true, name: true, description: true, isActive: true } as const;

const hasCode = (err: unknown, code: string): boolean =>
  typeof err === "object" && err !== null && "code" in err && err.code === code;

/** Prisma P2025: the row was deleted (e.g. by another admin) before we wrote to it. */
const isRecordNotFound = (err: unknown): boolean => hasCode(err, "P2025");
const isUniqueViolation = (err: unknown): boolean => hasCode(err, "P2002");

function nameTaken(message: string): IssueApiError {
  return new IssueApiError(409, message, { error: "name_taken", message });
}

/** Every marketing task type in the workspace. Only active ones can go on a new idea. */
export async function listMarketingTaskTypes(tenantId: string) {
  return prisma.issueType.findMany({
    where: { tenantId, ...MARKETING_TRACK },
    orderBy: { name: "asc" },
    select: taskTypeSelect,
  });
}

/**
 * Create a marketing task type. The name stays unique per tenant across both
 * tracks, matching the model's `(tenantId, name)` key, so a marketing type
 * can't shadow a product type.
 */
export async function createMarketingTaskType(tenantId: string, rawInput: unknown) {
  const input = createMarketingTaskTypeSchema.parse(rawInput);
  const existing = await prisma.issueType.findFirst({
    where: { tenantId, name: { equals: input.name, mode: "insensitive" } },
    select: { name: true },
  });
  if (existing) throw nameTaken(`A type named "${existing.name}" already exists.`);

  try {
    const created = await prisma.issueType.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description,
        track: "marketing",
        isActive: input.isActive,
      },
      select: taskTypeSelect,
    });
    expireTag(TAGS.issueTypes);
    return created;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) throw nameTaken(`A type named "${input.name}" already exists.`);
    throw err;
  }
}

/** Update a marketing task type. Renames leave a note on the tasks that carry the type. */
export async function updateMarketingTaskType(tenantId: string, id: string, actorUserId: string, rawInput: unknown) {
  const input = updateMarketingTaskTypeSchema.parse(rawInput);

  const current = await prisma.issueType.findFirst({
    where: { id, tenantId, ...MARKETING_TRACK },
    select: taskTypeSelect,
  });
  if (!current) throw new IssueApiError(404, TYPE_NOT_FOUND);

  if (input.name !== undefined) {
    const existing = await prisma.issueType.findFirst({
      where: { tenantId, name: { equals: input.name, mode: "insensitive" }, NOT: { id } },
      select: { name: true },
    });
    if (existing) throw nameTaken(`Another type named "${existing.name}" already exists.`);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.issueType.update({
        where: { id },
        data: { name: input.name, description: input.description, isActive: input.isActive },
        select: taskTypeSelect,
      });

      if (row.name !== current.name) {
        const linked = await tx.bug.findMany({ where: { typeId: id, tenantId }, select: { id: true } });
        if (linked.length > 0) {
          await tx.bugActivity.createMany({
            data: linked.map((task) => ({
              bugId: task.id,
              actorId: actorUserId,
              type: "type_changed",
              summary: typeChangedSummary(current.name, row.name),
              metadata: { field: "type", from: current.name, to: row.name },
            })),
          });
        }
      }
      return row;
    });
    expireTag(TAGS.issueTypes);
    return updated;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) throw nameTaken(`Another type named "${input.name}" already exists.`);
    if (isRecordNotFound(err)) throw new IssueApiError(404, TYPE_NOT_FOUND);
    throw err;
  }
}

/**
 * Delete a marketing task type. Types that tasks still use are refused, with
 * the reason and the thing to do instead: deactivate the type.
 */
export async function deleteMarketingTaskType(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.issueType.findFirst({
    where: { id, tenantId, ...MARKETING_TRACK },
    select: { id: true },
  });
  if (!existing) throw new IssueApiError(404, TYPE_NOT_FOUND);

  const usage = await prisma.bug.count({ where: { typeId: id, tenantId, ...MARKETING_TRACK } });
  const check = canDeleteIssueType(usage);
  if (!check.allowed) {
    throw new IssueApiError(409, check.reason ?? "This type is in use.", {
      error: "type_in_use",
      message: check.reason,
    });
  }

  try {
    await prisma.issueType.delete({ where: { id } });
  } catch (err: unknown) {
    if (isRecordNotFound(err)) throw new IssueApiError(404, TYPE_NOT_FOUND);
    throw err;
  }
  expireTag(TAGS.issueTypes);
}
