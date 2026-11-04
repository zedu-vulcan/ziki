import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentContext } from "@/lib/agents/require-agent";
import { hasLevel } from "@/lib/agents/levels";
import { audit } from "@/lib/agents/audit";
import { IssueApiError } from "@/lib/agent-api/errors";
import { publish } from "@/lib/agent-api/events";
import { parseIssueRef } from "@/lib/issue-ref";
import { categoryChangedSummary } from "@/lib/activity-log";
import { resolvePlatform, type PlatformView } from "@/lib/platforms";

/**
 * Putting an issue or idea on its platform (#platforms):
 * `PUT /api/v1/issues/{id}/platform` and `PUT /api/v1/ideas/{id}/platform`,
 * with `{ "platform": "<slug or id>" }`.
 *
 * - Any agent puts an uncategorized one on its platform. Agents should: the
 *   work feed and the lists are organised by platform, and one with none is
 *   easy to miss.
 * - Moving one that already has a platform to another needs a manager or
 *   merger agent (409 `already_categorized` otherwise): say why in `reason`.
 * - It is not an edit of the report: confirmations, verdicts and bids stay.
 *   The issue's activity records the change.
 */

export const platformAssignSchema = z
  .object({
    projectId: z.string().trim().min(1).max(191).optional(),
    platform: z.string().trim().min(1).max(191),
    /** Why, when moving it from one platform to another. */
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

type Scope = { tenantId: string; projectId: string };

export type PlatformAssignResult = {
  id: string;
  number: number;
  platform: PlatformView;
  previous: PlatformView | null;
  changed: boolean;
};

function parse(raw: unknown) {
  const parsed = platformAssignSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
    const message = field === "platform" ? "platform is required: a slug from GET /api/v1/platforms, such as desktop." : issue?.message ?? "Invalid request.";
    throw new IssueApiError(400, message, { error: "invalid_request", message, ...(field ? { field } : {}) });
  }
  return parsed.data;
}

/** Refuses a move between platforms to a working agent, and a move without a reason. */
function checkMove(agent: AgentContext, previous: PlatformView | null, next: PlatformView, reason: string | undefined) {
  if (!previous || previous.id === next.id) return;
  if (!hasLevel(agent.level, "manager")) {
    const message = `This is already on ${previous.slug}. Only a manager or merger agent moves it to another platform; if it is on the wrong one, say so in a comment.`;
    throw new IssueApiError(409, message, { error: "already_categorized", message, platform: previous });
  }
  if (!reason) {
    const message = "Moving it from one platform to another needs a reason.";
    throw new IssueApiError(400, message, { error: "invalid_request", message, field: "reason" });
  }
}

export async function setIssuePlatform(agent: AgentContext, scope: Scope, ref: string, raw: unknown): Promise<PlatformAssignResult> {
  const input = parse(raw);
  const parsed = parseIssueRef(ref);
  return prisma.$transaction(async (tx) => {
    const bug = await tx.bug.findFirst({
      where: { ...scope, isDeleted: false, ...(parsed.kind === "number" ? { number: parsed.number } : { id: parsed.id }) },
      select: { id: true, number: true, category: { select: { id: true, slug: true, name: true } } },
    });
    if (!bug) throw new IssueApiError(404, "Issue not found.");
    const next = await resolvePlatform(tx, scope.tenantId, input.platform);
    const previous = bug.category;
    checkMove(agent, previous, next, input.reason);
    if (previous?.id === next.id) return { id: bug.id, number: bug.number, platform: next, previous, changed: false };

    await tx.bug.update({ where: { id: bug.id }, data: { categoryId: next.id } });
    await tx.bugActivity.create({
      data: {
        bugId: bug.id,
        actorId: agent.ownerId,
        type: "category_changed",
        summary: categoryChangedSummary(previous?.name ?? null, next.name),
        metadata: { field: "category", from: previous?.name ?? null, to: next.name, viaAgentId: agent.agentId, ...(input.reason ? { reason: input.reason } : {}) },
      },
    });
    await audit(agent, "issue.platform_set", `issue:${bug.id}`, { from: previous?.slug ?? null, to: next.slug, reason: input.reason ?? null }, { bugId: bug.id, db: tx });
    await publish(tx, {
      tenantId: scope.tenantId,
      type: "issue.updated",
      actorAgentId: agent.agentId,
      bugId: bug.id,
      projectId: scope.projectId,
      payload: { issueId: bug.id, issueNumber: bug.number, field: "platform", from: previous?.slug ?? null, to: next.slug },
    });
    return { id: bug.id, number: bug.number, platform: next, previous, changed: true };
  });
}

export async function setIdeaPlatform(agent: AgentContext, scope: Scope, ref: string, raw: unknown): Promise<PlatformAssignResult> {
  const input = parse(raw);
  const parsed = parseIssueRef(ref);
  return prisma.$transaction(async (tx) => {
    const idea = await tx.idea.findFirst({
      where: { ...scope, isDeleted: false, ...(parsed.kind === "number" ? { number: parsed.number } : { id: parsed.id }) },
      select: { id: true, number: true, category: { select: { id: true, slug: true, name: true } } },
    });
    if (!idea) throw new IssueApiError(404, "Idea not found.");
    const next = await resolvePlatform(tx, scope.tenantId, input.platform);
    const previous = idea.category;
    checkMove(agent, previous, next, input.reason);
    if (previous?.id === next.id) return { id: idea.id, number: idea.number, platform: next, previous, changed: false };

    await tx.idea.update({ where: { id: idea.id }, data: { categoryId: next.id } });
    await audit(agent, "idea.platform_set", `idea:${idea.id}`, { from: previous?.slug ?? null, to: next.slug, reason: input.reason ?? null }, { db: tx });
    return { id: idea.id, number: idea.number, platform: next, previous, changed: true };
  });
}
