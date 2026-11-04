import type { AppRole } from "@/lib/roles";
import { isAdmin } from "@/lib/roles";
import { isTenantAdminRole } from "@/lib/agents/membership";
import { prisma } from "@/lib/prisma";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { platformSlug } from "@/lib/platforms";

export const DEFAULT_PLATFORMS = ["Desktop", "Web", "Mobile"] as const;
export const RETIRED_PLATFORMS = ["Backend", "Frontend", "FE"] as const;

/** Ensure this organization's standard platforms exist, and retire the old web names. */
export async function ensureDefaultPlatforms(tenantId: string): Promise<void> {
  await Promise.all(
    DEFAULT_PLATFORMS.map((name) =>
      prisma.category.upsert({
        where: { tenantId_name: { tenantId, name } },
        update: {},
        create: { tenantId, name, slug: platformSlug(name), isActive: true },
      }),
    ),
  );

  await prisma.category.updateMany({
    where: { tenantId, name: { in: [...RETIRED_PLATFORMS] }, isActive: true },
    data: { isActive: false },
  });
}

export type PlatformScope =
  | { ok: true; tenantId: string; tenantName: string; userId: string }
  | { ok: false; forbidden: boolean; error: string };

/**
 * The organization whose platforms this person may change.
 *
 * Site admins and the organization's owners and admins may. A member of
 * another organization may not, even if they are an admin there.
 */
export async function platformScopeFor(user: {
  id: string;
  role?: AppRole | null;
}): Promise<PlatformScope> {
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) {
    return {
      ok: false,
      forbidden: false,
      error: "Open an organization before managing platforms.",
    };
  }

  const [tenant, membership] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } }),
    prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      select: { role: true },
    }),
  ]);
  if (!tenant) {
    return {
      ok: false,
      forbidden: false,
      error: "Open an organization before managing platforms.",
    };
  }

  const allowed = isAdmin(user.role) || isTenantAdminRole(membership?.role, user.role);
  if (!allowed) {
    return {
      ok: false,
      forbidden: true,
      error: "You can't manage platforms for this organization.",
    };
  }

  return { ok: true, tenantId: tenant.id, tenantName: tenant.name, userId: user.id };
}
