import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IssueApiError } from "@/lib/agent-api/errors";

/**
 * Platforms (#platforms): where an issue or idea shows up, such as Desktop,
 * Web or Mobile (the `Category` table). Each has a `slug` ("desktop") that
 * agents use everywhere a platform is named: filing an idea, filtering the
 * issue and idea lists, and putting an uncategorized issue or idea on its
 * platform. The id works too. Issues and ideas return it as
 * `platform: { id, slug, name }`.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export type PlatformView = { id: string; slug: string; name: string };

/** Select a platform the way the API returns it. */
export const platformSelect = { id: true, slug: true, name: true } as const satisfies Prisma.CategorySelect;

/** "Desktop app" → "desktop-app". The same rule the slug migration applied. */
export function platformSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "platform";
}

/** A slug for a new platform that no other platform in the workspace has: "web", then "web-2", … */
export async function uniquePlatformSlug(db: Db, tenantId: string, name: string): Promise<string> {
  const base = platformSlug(name);
  const taken = new Set(
    (await db.category.findMany({ where: { tenantId, slug: { startsWith: base } }, select: { slug: true } })).map((row) => row.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** The workspace's active platforms, in name order: `GET /api/v1/platforms`. */
export async function listPlatforms(tenantId: string, db: Db = prisma): Promise<PlatformView[]> {
  return db.category.findMany({ where: { tenantId, isActive: true }, orderBy: [{ name: "asc" }, { id: "asc" }], select: platformSelect });
}

/** Whether `ref` names `platform`, by slug (any case) or id. */
export function matchesPlatform(platform: { id: string; slug: string }, ref: string): boolean {
  const value = ref.trim();
  return platform.id === value || platform.slug === value.toLowerCase();
}

/**
 * The active platform `ref` names (its slug or id) in the workspace. A name
 * that matches none is a 422 listing the slugs to use.
 */
export async function resolvePlatform(db: Db, tenantId: string, ref: string, field = "platform"): Promise<PlatformView> {
  const platforms = await listPlatforms(tenantId, db);
  const found = platforms.find((platform) => matchesPlatform(platform, ref));
  if (!found) {
    const known = platforms.map((platform) => platform.slug).join(", ") || "none";
    const message = `Unknown platform "${ref.trim()}". Use a slug from GET /api/v1/platforms: ${known}.`;
    throw new IssueApiError(422, message, { error: "unknown_platform", message, field, platforms: platforms.map((p) => p.slug) });
  }
  return found;
}

/** Replaces Prisma's `category` relation with the API's `platform` field. */
export function withPlatform<T extends { category?: PlatformView | null }>(row: T): Omit<T, "category"> & { platform: PlatformView | null } {
  const { category, ...rest } = row;
  return { ...rest, platform: category ?? null };
}
