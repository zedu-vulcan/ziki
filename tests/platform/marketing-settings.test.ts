import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.hoisted(() => vi.fn());
const isTenantAdmin = vi.hoisted(() => vi.fn());
const currentTenantIdFor = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const invalidateWorkflow = vi.hoisted(() => vi.fn());
const findFirst = vi.hoisted(() => vi.fn());
const findUnique = vi.hoisted(() => vi.fn());
const upsert = vi.hoisted(() => vi.fn());
const auditCreate = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const requireAgent = vi.hoisted(() => vi.fn());
const typeFindFirst = vi.hoisted(() => vi.fn());
const typeFindMany = vi.hoisted(() => vi.fn());
const typeCreate = vi.hoisted(() => vi.fn());
const typeDelete = vi.hoisted(() => vi.fn());
const bugCount = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next-auth", () => ({ default: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath, updateTag: vi.fn() }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser }));
vi.mock("@/lib/agents/membership", () => ({ isTenantAdmin }));
vi.mock("@/lib/tenant-context", () => ({
  currentTenantIdFor,
  NO_TENANT_MESSAGE: "You're not a member of a workspace yet.",
}));
vi.mock("@/lib/workflow", () => ({
  invalidateWorkflow,
  workflowFor: vi.fn(async (projectId: string) => {
    const row = await findUnique({ where: { projectId } });
    return { revisionLimit: row?.revisionLimit ?? 2 };
  }),
}));
vi.mock("@/lib/agents/require-agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agents/require-agent")>()),
  requireAgent,
}));
vi.mock("@/lib/agents/rate-budget", () => ({
  consumeAgentBudget: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst, findUnique },
    projectWorkflow: { findUnique, upsert },
    projectAuditEvent: { create: auditCreate },
    agentAuditEvent: { create: vi.fn() },
    user: { findUnique },
    issueType: { findFirst: typeFindFirst, findMany: typeFindMany, create: typeCreate, delete: typeDelete },
    bug: { count: bugCount },
    $transaction: transaction,
  },
}));

import {
  assertMarketingSettingsAccess,
  getMarketingSettings,
  updateMarketingSettings,
} from "@/lib/marketing/settings";
import { updateMarketingSettingsAction } from "@/app/actions/marketing-settings";
import { GET, PATCH } from "@/app/api/v1/projects/[id]/marketing-settings/route";
import { GET as MarketingGET, PATCH as MarketingPATCH } from "@/app/api/v1/marketing/settings/route";
import { GET as TypesGET, POST as TypesPOST } from "@/app/api/v1/marketing/task-types/route";
import { DELETE as TypeDELETE, PATCH as TypePATCH } from "@/app/api/v1/marketing/task-types/[id]/route";
import { NextRequest } from "next/server";

describe("Marketing task types API (M-API-7)", () => {
  const url = "http://localhost/api/v1/marketing/task-types";
  const headers = { authorization: "Bearer ziki_test" };
  const post = (body: unknown) => new NextRequest(url, { method: "POST", headers, body: JSON.stringify(body) });
  const onType = (id: string) => ({ params: Promise.resolve({ id }) });

  beforeEach(() => {
    vi.clearAllMocks();
    isTenantAdmin.mockResolvedValue(true);
    typeFindFirst.mockResolvedValue(null);
    requireAgent.mockResolvedValue({
      agentId: "agent-1",
      name: "TestAgent",
      ownerId: "owner-1",
      tenantId: "tenant-1",
      level: "working",
      ownerRole: "member",
      burst: false,
      keyId: "key-1",
    });
  });

  it("lists only this workspace's marketing types, for any agent", async () => {
    isTenantAdmin.mockResolvedValue(false);
    typeFindMany.mockResolvedValue([{ id: "type-1", name: "Blog post", description: null, isActive: true }]);
    const res = await TypesGET(new NextRequest(url, { headers }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [{ id: "type-1", name: "Blog post", description: null, isActive: true }] });
    expect(typeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-1", track: "marketing" } }),
    );
  });

  it("creates a type on the marketing track for a workspace admin's agent", async () => {
    typeCreate.mockResolvedValue({ id: "type-1", name: "Blog post", description: null, isActive: true });
    const res = await TypesPOST(post({ name: "Blog post" }));
    expect(res.status).toBe(201);
    expect(typeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-1", name: "Blog post", track: "marketing", isActive: true }),
      }),
    );
  });

  it("refuses every change from an agent whose owner is not a workspace admin", async () => {
    isTenantAdmin.mockResolvedValue(false);
    const created = await TypesPOST(post({ name: "Blog post" }));
    const updated = await TypePATCH(
      new NextRequest(`${url}/type-1`, { method: "PATCH", headers, body: JSON.stringify({ isActive: false }) }),
      onType("type-1"),
    );
    const deleted = await TypeDELETE(new NextRequest(`${url}/type-1`, { method: "DELETE", headers }), onType("type-1"));
    expect([created.status, updated.status, deleted.status]).toEqual([403, 403, 403]);
    expect(typeCreate).not.toHaveBeenCalled();
    expect(typeDelete).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("refuses a name another type already has, in any letter case", async () => {
    typeFindFirst.mockResolvedValue({ name: "Blog post" });
    const res = await TypesPOST(post({ name: "BLOG POST" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "name_taken" });
    expect(typeCreate).not.toHaveBeenCalled();
  });

  it("refuses points on a type, because pay comes from each task's reward", async () => {
    const res = await TypesPOST(post({ name: "Blog post", points: 5 }));
    expect(res.status).toBe(422);
    expect(typeCreate).not.toHaveBeenCalled();
  });

  it("treats a product type or another workspace's type as not found", async () => {
    const res = await TypeDELETE(new NextRequest(`${url}/type-1`, { method: "DELETE", headers }), onType("type-1"));
    expect(res.status).toBe(404);
    expect(typeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "type-1", tenantId: "tenant-1", track: "marketing" } }),
    );
    expect(typeDelete).not.toHaveBeenCalled();
  });

  it("refuses to delete a type marketing tasks use, and deletes one they don't", async () => {
    typeFindFirst.mockResolvedValue({ id: "type-1" });
    bugCount.mockResolvedValueOnce(2);
    const inUse = await TypeDELETE(new NextRequest(`${url}/type-1`, { method: "DELETE", headers }), onType("type-1"));
    expect(inUse.status).toBe(409);
    expect(await inUse.json()).toMatchObject({ error: "type_in_use" });
    expect(typeDelete).not.toHaveBeenCalled();

    bugCount.mockResolvedValueOnce(0);
    const unused = await TypeDELETE(new NextRequest(`${url}/type-1`, { method: "DELETE", headers }), onType("type-1"));
    expect(unused.status).toBe(204);
    expect(typeDelete).toHaveBeenCalledWith({ where: { id: "type-1" } });
  });
});

describe("Marketing settings core (M-API-6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTenantAdmin.mockResolvedValue(true);
    findFirst.mockResolvedValue({ id: "proj-1", slug: "marketing-proj", name: "Marketing Proj", workflow: null });
    findUnique.mockResolvedValue({ revisionLimit: 2 });
    transaction.mockImplementation(async (run: (tx: unknown) => unknown) =>
      run({
        projectWorkflow: { upsert },
        projectAuditEvent: { create: auditCreate },
      }),
    );
  });

  describe("assertMarketingSettingsAccess", () => {
    it("allows a workspace owner or admin", async () => {
      isTenantAdmin.mockResolvedValue(true);
      await expect(assertMarketingSettingsAccess({ id: "user-1" }, "tenant-1", "change")).resolves.toBeUndefined();
    });

    it("refuses a member who is not an admin with 403", async () => {
      isTenantAdmin.mockResolvedValue(false);
      await expect(assertMarketingSettingsAccess({ id: "user-2" }, "tenant-1", "change")).rejects.toThrow(
        "Only workspace owners and admins can change marketing settings.",
      );
      await expect(assertMarketingSettingsAccess({ id: "user-2" }, "tenant-1", "view")).rejects.toThrow(
        "Only workspace owners and admins can view marketing settings.",
      );
    });
  });

  describe("getMarketingSettings", () => {
    it("returns the project's revision limit, defaulting to 2", async () => {
      findUnique.mockResolvedValueOnce(null);
      const res = await getMarketingSettings("tenant-1", "proj-1");
      expect(res).toEqual({
        projectId: "proj-1",
        slug: "marketing-proj",
        name: "Marketing Proj",
        revisionLimit: 2,
      });
    });

    it("returns stored revision limit if present", async () => {
      findUnique.mockResolvedValueOnce({ revisionLimit: 5 });
      const res = await getMarketingSettings("tenant-1", "marketing-proj");
      expect(res.revisionLimit).toBe(5);
    });

    it("throws 404 if project is not found in tenant", async () => {
      findFirst.mockResolvedValueOnce(null);
      await expect(getMarketingSettings("tenant-1", "unknown")).rejects.toThrow("Project not found.");
    });
  });

  describe("updateMarketingSettings", () => {
    it("validates that revisionLimit is within 1 to 10", async () => {
      await expect(updateMarketingSettings("tenant-1", "proj-1", "user-1", { revisionLimit: 0 })).rejects.toThrow(
        "Revision limit must be at least 1.",
      );
      await expect(updateMarketingSettings("tenant-1", "proj-1", "user-1", { revisionLimit: 11 })).rejects.toThrow(
        "Revision limit must be at most 10.",
      );
      await expect(updateMarketingSettings("tenant-1", "proj-1", "user-1", { revisionLimit: 3.5 })).rejects.toThrow(
        "Revision limit must be a whole number.",
      );
    });

    it("saves the new revision limit, audits it, and invalidates cache", async () => {
      findUnique.mockResolvedValueOnce({ revisionLimit: 2 });
      const res = await updateMarketingSettings("tenant-1", "proj-1", "user-1", { revisionLimit: 4 });

      expect(res).toEqual({
        projectId: "proj-1",
        slug: "marketing-proj",
        name: "Marketing Proj",
        revisionLimit: 4,
      });

      expect(upsert).toHaveBeenCalledWith({
        where: { projectId: "proj-1" },
        update: { revisionLimit: 4 },
        create: { projectId: "proj-1", revisionLimit: 4 },
      });

      expect(auditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          projectId: "proj-1",
          actorUserId: "user-1",
          action: "marketing.settings.updated",
          changes: { revisionLimit: { from: 2, to: 4 } },
        }),
      });

      expect(invalidateWorkflow).toHaveBeenCalledWith("proj-1");
    });

    it("skips writing if the limit is unchanged", async () => {
      findUnique.mockResolvedValueOnce({ revisionLimit: 2 });
      await updateMarketingSettings("tenant-1", "proj-1", "user-1", { revisionLimit: 2 });
      expect(upsert).not.toHaveBeenCalled();
      expect(auditCreate).not.toHaveBeenCalled();
    });

    it("throws 404 if project does not exist", async () => {
      findFirst.mockResolvedValueOnce(null);
      await expect(updateMarketingSettings("tenant-1", "missing", "user-1", { revisionLimit: 3 })).rejects.toThrow(
        "Project not found.",
      );
    });
  });
});

describe("Marketing settings API route (M-API-6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTenantAdmin.mockResolvedValue(true);
    findFirst.mockResolvedValue({ id: "proj-1", slug: "marketing-proj", name: "Marketing Proj", workflow: null });
    findUnique.mockResolvedValue({ revisionLimit: 2 });
    requireAgent.mockResolvedValue({
      agentId: "agent-1",
      name: "TestAgent",
      ownerId: "owner-1",
      tenantId: "tenant-1",
      level: "working",
      ownerRole: "admin",
      burst: false,
      keyId: "key-1",
    });
    transaction.mockImplementation(async (run: (tx: unknown) => unknown) =>
      run({
        projectWorkflow: { upsert },
        projectAuditEvent: { create: auditCreate },
      }),
    );
  });

  it("GET /api/v1/projects/[id]/marketing-settings returns 200 with dials for an admin agent", async () => {
    const req = new NextRequest("http://localhost/api/v1/projects/proj-1/marketing-settings", {
      headers: { authorization: "Bearer ziki_test" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "proj-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      projectId: "proj-1",
      slug: "marketing-proj",
      revisionLimit: 2,
    });
  });

  it("GET returns 403 if agent owner is not a workspace admin", async () => {
    isTenantAdmin.mockResolvedValue(false);
    const req = new NextRequest("http://localhost/api/v1/projects/proj-1/marketing-settings", {
      headers: { authorization: "Bearer ziki_test" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "proj-1" }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Only workspace owners and admins can view marketing settings.");
  });

  it("PATCH /api/v1/projects/[id]/marketing-settings updates revisionLimit", async () => {
    const req = new NextRequest("http://localhost/api/v1/projects/proj-1/marketing-settings", {
      method: "PATCH",
      headers: {
        authorization: "Bearer ziki_test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ revisionLimit: 3 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "proj-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      projectId: "proj-1",
      revisionLimit: 3,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { revisionLimit: 3 },
      }),
    );
  });

  it("PATCH returns 400 if revisionLimit is out of range", async () => {
    const req = new NextRequest("http://localhost/api/v1/projects/proj-1/marketing-settings", {
      method: "PATCH",
      headers: {
        authorization: "Bearer ziki_test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ revisionLimit: 20 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "proj-1" }) });
    expect(res.status).toBe(400);
  });

  it("GET and PATCH work on /api/v1/marketing/settings with ?projectId=", async () => {
    const getReq = new NextRequest("http://localhost/api/v1/marketing/settings?projectId=proj-1", {
      headers: { authorization: "Bearer ziki_test" },
    });
    const getRes = await MarketingGET(getReq);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.revisionLimit).toBe(2);

    const patchReq = new NextRequest("http://localhost/api/v1/marketing/settings?projectId=proj-1", {
      method: "PATCH",
      headers: {
        authorization: "Bearer ziki_test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ revisionLimit: 5 }),
    });
    const patchRes = await MarketingPATCH(patchReq);
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.revisionLimit).toBe(5);
  });
});

describe("updateMarketingSettingsAction (M-API-6, M-UI-7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "user-admin", role: "admin" });
    isTenantAdmin.mockResolvedValue(true);
    currentTenantIdFor.mockResolvedValue("tenant-1");
    findFirst.mockResolvedValue({ id: "proj-1", slug: "marketing-proj", name: "Marketing Proj", workflow: null });
    findUnique.mockResolvedValue({ revisionLimit: 2 });
    transaction.mockImplementation(async (run: (tx: unknown) => unknown) =>
      run({
        projectWorkflow: { upsert },
        projectAuditEvent: { create: auditCreate },
      }),
    );
  });

  it("updates revision limit through form action and revalidates paths", async () => {
    const fd = new FormData();
    fd.set("slug", "marketing-proj");
    fd.set("revisionLimit", "4");

    const res = await updateMarketingSettingsAction(undefined, fd);
    expect(res).toEqual({ ok: true, revisionLimit: 4 });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { revisionLimit: 4 },
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/marketing-proj/marketing/settings");
    expect(revalidatePath).toHaveBeenCalledWith("/marketing-proj/settings");
  });

  it("rejects non-admins", async () => {
    isTenantAdmin.mockResolvedValue(false);
    const fd = new FormData();
    fd.set("slug", "marketing-proj");
    fd.set("revisionLimit", "4");

    const res = await updateMarketingSettingsAction(undefined, fd);
    expect(res).toMatchObject({
      ok: false,
      error: "Only workspace owners and admins can change marketing settings.",
    });
  });

  it("rejects invalid revision limits with fieldErrors", async () => {
    const fd = new FormData();
    fd.set("slug", "marketing-proj");
    fd.set("revisionLimit", "15");

    const res = await updateMarketingSettingsAction(undefined, fd);
    expect(res).toMatchObject({
      ok: false,
      fieldErrors: { revisionLimit: expect.stringContaining("at most 10") },
    });
  });
});
