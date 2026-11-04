import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest } from "@/lib/agent-api/issues";
import { listPlatforms } from "@/lib/platforms";

/**
 * GET /api/v1/platforms — the workspace's platforms (#platforms), each
 * `{ id, slug, name }`, such as `{ "slug": "desktop", "name": "Desktop" }`.
 * List them first: issues and ideas are organised by platform, and every
 * route that names one takes its `slug` (filing an idea, `?platform=` on the
 * issue and idea lists, `PUT /issues/{id}/platform`, `PUT /ideas/{id}/platform`).
 */
export async function GET(request: NextRequest) {
  return agentIssueRequest(request, "platforms.list", "read", null, async (agent) => {
    return NextResponse.json({ items: await listPlatforms(agent.tenantId) });
  });
}

const apiMethodNotAllowed = createMethodNotAllowed(["GET", "HEAD", "OPTIONS"]);
const apiOptions = createOptions(["GET", "HEAD", "OPTIONS"]);
export const POST = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = apiOptions;
