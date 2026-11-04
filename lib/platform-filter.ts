import type { Prisma } from "@prisma/client";

/** Query-string key for the platform (category) filter. */
export const PLATFORM_PARAM = "platform";

/** Value that selects issues with no platform set, which is a real state. */
export const PLATFORM_NONE = "none";

export type PlatformOption = { id: string; name: string; slug?: string; isActive?: boolean };

/**
 * The selected platform, as either a category id, "none", or null for "all".
 * The value may be the platform's id or its slug (#platforms: "desktop"); it
 * resolves to the id.
 *
 * Validate against every platform, active or not: a deactivated platform
 * still has issues attached, and a shared link to them has to keep working.
 * Only an id that does not exist at all — a deleted platform in someone's
 * bookmark — resolves to null, so the page shows every issue rather than
 * silently showing nothing.
 */
export function parsePlatformFilter(
  raw: string | string[] | null | undefined,
  platforms: readonly PlatformOption[],
): string | null {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!value) return null;
  if (value === PLATFORM_NONE) return PLATFORM_NONE;
  const lower = value.toLowerCase();
  return platforms.find((p) => p.id === value || p.slug === lower)?.id ?? null;
}

/** The `where` fragment for a parsed filter; `{}` when nothing is selected. */
export function platformFilterWhere(
  selected: string | null,
): Prisma.BugWhereInput {
  if (!selected) return {};
  if (selected === PLATFORM_NONE) return { categoryId: null };
  return { categoryId: selected };
}

/** Label for the current selection, for the results summary line. */
export function platformFilterLabel(
  selected: string | null,
  platforms: readonly PlatformOption[],
): string | null {
  if (!selected) return null;
  if (selected === PLATFORM_NONE) return "no platform";
  return platforms.find((p) => p.id === selected)?.name ?? null;
}

/**
 * What to offer in the dropdown: the active platforms, plus whichever one is
 * currently selected so a deactivated platform in a shared link still shows
 * its own name instead of snapping back to "All".
 */
export function platformChoices<T extends PlatformOption>(
  platforms: readonly T[],
  selected: string | null,
): T[] {
  return platforms.filter(
    (p) => p.isActive !== false || p.id === selected,
  );
}
