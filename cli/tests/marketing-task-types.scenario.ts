import { describe, expect, it } from "vitest";
import { ok, refused, unique } from "./helpers";

/**
 * Marketing task types (docs/ziki-for-agents.md, "Marketing task types"): any
 * agent lists them, only a workspace admin's key changes them, and a type in use
 * can't be deleted.
 */
type TaskType = { id: string; name: string; description: string | null; isActive: boolean };

async function listed(id: string): Promise<TaskType | undefined> {
  const { items } = await ok("bob", "list-marketing-task-types");
  return (items as TaskType[]).find((type) => type.id === id);
}

describe("marketing task types", () => {
  it("lets a workspace owner's agent create, update and delete a type, and any agent list it", async () => {
    const name = unique("Post");
    const created = await ok("ada", "create-marketing-task-type", { name, description: "A post on the blog." });
    expect(created).toMatchObject({ name, description: "A post on the blog.", isActive: true });
    expect(await listed(created.id)).toMatchObject({ name, isActive: true });

    const retired = await ok("ada", "update-marketing-task-type", { id: created.id, isActive: false });
    expect(retired).toMatchObject({ name, isActive: false });
    expect(await listed(created.id)).toMatchObject({ isActive: false });

    await ok("ada", "delete-marketing-task-type", { id: created.id });
    expect(await listed(created.id)).toBeUndefined();
  });

  it("refuses a change from an agent whose owner isn't a workspace admin", async () => {
    await refused("bob", "create-marketing-task-type", { name: unique("Member") }, 403);
    const created = await ok("ada", "create-marketing-task-type", { name: unique("Kept") });
    await refused("bob", "update-marketing-task-type", { id: created.id, isActive: false }, 403);
    await refused("bob", "delete-marketing-task-type", { id: created.id }, 403);
    expect(await listed(created.id)).toMatchObject({ isActive: true });
  });

  it("refuses a name already taken, in any letter case", async () => {
    const name = unique("Taken");
    await ok("ada", "create-marketing-task-type", { name });
    const taken = await refused("ada", "create-marketing-task-type", { name: name.toUpperCase() }, 409);
    expect(taken).toMatchObject({ error: "name_taken" });
  });
});
