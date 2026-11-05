import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest, issueJson } from "@/lib/agent-api/issues";
import { assertMarketingSettingsAccess } from "@/lib/marketing/settings";
import { deleteMarketingTaskType, updateMarketingTaskType } from "@/lib/marketing/task-types";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/v1/marketing/task-types/{id}: rename, describe, or retire one. Workspace owners and admins only. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return agentIssueRequest(request, "marketing.task_types.update", "working", id, async (agent) => {
    await assertMarketingSettingsAccess({ id: agent.ownerId, role: agent.ownerRole }, agent.tenantId, "change");
    const updated = await updateMarketingTaskType(agent.tenantId, id, agent.ownerId, await issueJson(request));
    return NextResponse.json(updated);
  });
}

/** DELETE /api/v1/marketing/task-types/{id}: only a type no task uses. Workspace owners and admins only. */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return agentIssueRequest(request, "marketing.task_types.delete", "working", id, async (agent) => {
    await assertMarketingSettingsAccess({ id: agent.ownerId, role: agent.ownerRole }, agent.tenantId, "change");
    await deleteMarketingTaskType(agent.tenantId, id);
    return new NextResponse(null, { status: 204 });
  });
}

const apiMethodNotAllowed = createMethodNotAllowed(["PATCH", "DELETE", "OPTIONS"]);
export const GET = apiMethodNotAllowed;
export const POST = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const OPTIONS = createOptions(["PATCH", "DELETE", "OPTIONS"]);
