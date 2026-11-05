import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { agentIssueRequest, issueProject, issueJson } from "@/lib/agent-api/issues";
import { prisma } from "@/lib/prisma";
import { issueIdFor } from "@/lib/issue-ref";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";

const planSchema = z.object({ plan: z.string().trim().min(1).max(2000) }).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; steerId: string }> }) {
  const { id, steerId } = await context.params;
  return agentIssueRequest(request, "agents.steer.acknowledge", "working", steerId, async (agent) => {
    const body = planSchema.parse(await issueJson(request));
    const scope = await issueProject(agent, request.nextUrl.searchParams);
    const bugId = await issueIdFor(prisma, id, agent.tenantId);
    if (!bugId) return NextResponse.json({ error: "Issue not found." }, { status: 404 });
    const bug = await prisma.bug.findFirst({ where: { id: bugId, projectId: scope.projectId }, select: { id: true } });
    if (!bug) return NextResponse.json({ error: "Issue not found in this project." }, { status: 404 });
    const note = await prisma.agentInboxItem.findFirst({
      where: { id: steerId, agentId: agent.agentId, bugId, eventType: "agent.steer" },
      select: { id: true, payload: true },
    });
    if (!note) return NextResponse.json({ error: "Steer note not found." }, { status: 404 });
    await prisma.agentInboxItem.update({
      where: { id: note.id },
      data: { payload: { ...(note.payload as Record<string, unknown>), plan: body.plan, acknowledgedAt: new Date().toISOString() } },
    });
    return NextResponse.json({ acknowledged: true, projectId: scope.projectId });
  }, { budget: "write" });
}

const methodNotAllowed = createMethodNotAllowed(["POST", "OPTIONS"]);
const options = createOptions(["POST", "OPTIONS"]);
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const OPTIONS = options;
