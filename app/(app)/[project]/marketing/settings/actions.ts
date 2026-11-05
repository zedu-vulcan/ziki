"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { IssueApiError } from "@/lib/agent-api/errors";
import { expireTag, TAGS } from "@/lib/cache-tags";
import { assertMarketingSettingsAccess, updateMarketingSettings } from "@/lib/marketing/settings";
import {
  createMarketingTaskType,
  deleteMarketingTaskType,
  updateMarketingTaskType,
} from "@/lib/marketing/task-types";
import { marketingPath } from "@/lib/project-paths";
import { prisma } from "@/lib/prisma";
import { requireProject } from "@/lib/project-route";
import { revisionLimitSchema } from "@/lib/workflow-config";

export type MarketingSettingsActionResult = { error?: string; ok?: boolean };

const TYPE_NOT_FOUND = "Marketing task type not found.";

/** Prisma P2025: the row was deleted (e.g. by another admin) before we wrote to it. */
function isRecordNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2025";
}

/**
 * The project whose marketing settings are being changed, after the access
 * check. Members are refused with the message from the rule, so they read the
 * settings but never change them.
 */
async function requireSettingsAdmin(slug: string) {
  const context = await requireProject(slug, marketingPath(slug, "settings"));
  try {
    await assertMarketingSettingsAccess(context.user, context.tenantId, "change");
  } catch (error) {
    if (error instanceof IssueApiError) return { error: error.message };
    throw error;
  }
  return {
    tenantId: context.tenantId,
    projectId: context.project.id,
    projectSlug: context.project.slug,
    userId: context.user.id,
  };
}

function revalidateMarketing(slug: string): void {
  revalidatePath(marketingPath(slug, "settings"));
  revalidatePath(marketingPath(slug));
}

/**
 * The revision limit dial (M-UI-7 for M-API-6): how many send-backs a marketing
 * delivery takes before the task reopens for bids. The lib function owns the
 * rule: it bounds the value to 1–10, refuses non-admins and audits the change.
 */
export async function updateMarketingRevisionLimitAction(
  slug: string,
  formData: FormData,
): Promise<MarketingSettingsActionResult> {
  const admin = await requireSettingsAdmin(slug);
  if ("error" in admin) return admin;

  const parsed = revisionLimitSchema.safeParse(Number(formData.get("revisionLimit")));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revision limit must be a whole number from 1 to 10." };
  }

  try {
    await updateMarketingSettings(admin.tenantId, admin.projectId, admin.userId, { revisionLimit: parsed.data });
  } catch (error) {
    if (error instanceof IssueApiError) return { error: error.message };
    throw error;
  }

  revalidateMarketing(slug);
  return { ok: true };
}

/** The form fields a task type carries; no points, because pay comes from each task's reward. */
function typeInput(formData: FormData) {
  const rawDescription = formData.get("description")?.toString() ?? "";
  const rawActive = formData.get("isActive");
  return {
    name: formData.get("name")?.toString() ?? "",
    description: rawDescription ? rawDescription : null,
    // An unticked checkbox isn't sent, so a missing value means inactive.
    isActive: rawActive === "true" || rawActive === "on",
  };
}

/** Runs a change whose rules live in `lib/marketing/`, giving a refusal back to the form. */
async function applyChange(slug: string, change: () => Promise<unknown>): Promise<MarketingSettingsActionResult> {
  try {
    await change();
  } catch (error) {
    if (error instanceof IssueApiError) return { error: error.message };
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Check the form and try again." };
    throw error;
  }
  revalidateMarketing(slug);
  return { ok: true };
}

/** Create a marketing task type (M-UI-7 for M-API-7). */
export async function createMarketingIssueTypeAction(
  slug: string,
  formData: FormData,
): Promise<MarketingSettingsActionResult> {
  const admin = await requireSettingsAdmin(slug);
  if ("error" in admin) return admin;

  return applyChange(slug, () => createMarketingTaskType(admin.tenantId, typeInput(formData)));
}

/** Update a marketing task type. */
export async function updateMarketingIssueTypeAction(
  slug: string,
  id: string,
  formData: FormData,
): Promise<MarketingSettingsActionResult> {
  const admin = await requireSettingsAdmin(slug);
  if ("error" in admin) return admin;
  if (!id || typeof id !== "string") return { error: "Invalid task type." };

  return applyChange(slug, () => updateMarketingTaskType(admin.tenantId, id, admin.userId, typeInput(formData)));
}

/** Active types are offered when a marketing task is proposed; retired ones keep their history. */
export async function toggleMarketingIssueTypeActiveAction(
  slug: string,
  id: string,
): Promise<MarketingSettingsActionResult> {
  const admin = await requireSettingsAdmin(slug);
  if ("error" in admin) return admin;
  if (!id || typeof id !== "string") return { error: "Invalid task type." };

  const existing = await prisma.issueType.findFirst({
    where: { id, tenantId: admin.tenantId, track: "marketing" },
    select: { isActive: true },
  });
  if (!existing) return { error: TYPE_NOT_FOUND };

  try {
    await prisma.issueType.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  } catch (err: unknown) {
    if (isRecordNotFound(err)) return { error: TYPE_NOT_FOUND };
    throw err;
  }

  expireTag(TAGS.issueTypes);
  revalidateMarketing(slug);
  return { ok: true };
}

/** Delete a marketing task type, unless tasks still use it. */
export async function deleteMarketingIssueTypeAction(
  slug: string,
  id: string,
): Promise<MarketingSettingsActionResult> {
  const admin = await requireSettingsAdmin(slug);
  if ("error" in admin) return admin;
  if (!id || typeof id !== "string") return { error: "Invalid task type." };

  return applyChange(slug, () => deleteMarketingTaskType(admin.tenantId, id));
}
