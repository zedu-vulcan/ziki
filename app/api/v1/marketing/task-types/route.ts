import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest, issueJson } from "@/lib/agent-api/issues";
import { assertMarketingSettingsAccess } from "@/lib/marketing/settings";
import { createMarketingTaskType, listMarketingTaskTypes } from "@/lib/marketing/task-types";

/** GET /api/v1/marketing/task-types: the workspace's marketing task types, for `typeId` on a marketing idea. */
export async function GET(request: NextRequest) {
  return agentIssueRequest(request, "marketing.task_types.list", "read", null, async (agent) => {
    return NextResponse.json({ items: await listMarketingTaskTypes(agent.tenantId) });
  });
}

/** POST /api/v1/marketing/task-types: add one. The key's owner must be a workspace owner or admin. */
export async function POST(request: NextRequest) {
  return agentIssueRequest(request, "marketing.task_types.create", "working", null, async (agent) => {
    await assertMarketingSettingsAccess({ id: agent.ownerId, role: agent.ownerRole }, agent.tenantId, "change");
    const created = await createMarketingTaskType(agent.tenantId, await issueJson(request));
    return NextResponse.json(created, { status: 201 });
  });
}

const apiMethodNotAllowed = createMethodNotAllowed(["GET", "HEAD", "POST", "OPTIONS"]);
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = createOptions(["GET", "HEAD", "POST", "OPTIONS"]);
