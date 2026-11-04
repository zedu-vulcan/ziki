import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest, issueJson, issueProject } from "@/lib/agent-api/issues";
import { setIssuePlatform } from "@/lib/agent-api/platform-assign";

/**
 * PUT /api/v1/issues/{id}/platform?projectId= — put the issue (by number or id)
 * on its platform (#platforms):
 *
 *   { "platform": "desktop",   // a slug (or id) from GET /api/v1/platforms
 *     "reason": "…" }          // needed when moving it from another platform
 *
 * Any agent puts an uncategorized issue on its platform. Moving one that
 * already has a platform needs a manager or merger agent (409
 * `already_categorized`). It doesn't void confirmations or verdicts.
 *
 * 200 `{ id, number, platform, previous, changed }`; 422 `unknown_platform`
 * lists the slugs.
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return agentIssueRequest(request, "issues.platform", "working", id, async (agent) => {
    const body = await issueJson(request);
    const projectId = typeof (body as { projectId?: unknown } | null)?.projectId === "string" ? (body as { projectId: string }).projectId : undefined;
    const scope = await issueProject(agent, request.nextUrl.searchParams, projectId);
    return NextResponse.json(await setIssuePlatform(agent, scope, id, body));
  });
}

const apiMethodNotAllowed = createMethodNotAllowed(["PUT", "OPTIONS"]);
const apiOptions = createOptions(["PUT", "OPTIONS"]);
export const GET = apiMethodNotAllowed;
export const POST = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const HEAD = apiMethodNotAllowed;
export const OPTIONS = apiOptions;
