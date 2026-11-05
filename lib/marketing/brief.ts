import { prisma } from "@/lib/prisma";
import { projectBriefSchema } from "@/lib/validations/marketing";

/** The brief as agents read it (docs/ziki-for-agents.md, "The project brief"). */
export type AgentBrief = {
  product: string | null;
  audience: string | null;
  website: string | null;
  current_focus: string | null;
  out_of_scope: string | null;
};

/** The project's brief for agents, or `null` when nobody has filled any of it in. */
export async function readProjectBrief(projectId: string): Promise<AgentBrief | null> {
  const row = await prisma.projectBrief.findUnique({ where: { projectId } });
  if (!row) return null;
  const brief: AgentBrief = {
    product: row.product,
    audience: row.audience,
    website: row.website,
    current_focus: row.currentFocus,
    out_of_scope: row.outOfScope,
  };
  return Object.values(brief).some(Boolean) ? brief : null;
}

/**
 * Save a project's whole brief and audit which fields changed. Callers check the
 * person may change marketing settings and that the project is in their tenant.
 */
export async function saveProjectBrief(
  tenantId: string,
  projectId: string,
  actorUserId: string,
  rawInput: unknown,
): Promise<void> {
  const brief = projectBriefSchema.parse(rawInput);
  const current = await prisma.projectBrief.findUnique({ where: { projectId } });
  const fields = (Object.keys(brief) as (keyof typeof brief)[]).filter(
    (field) => brief[field] !== (current?.[field] ?? null),
  );
  if (fields.length === 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.projectBrief.upsert({
      where: { projectId },
      update: brief,
      create: { projectId, ...brief },
    });
    await tx.projectAuditEvent.create({
      data: { tenantId, projectId, actorUserId, action: "marketing.brief.updated", changes: { fields } },
    });
  });
}
