import { describe, expect, it, vi } from "vitest";

// Stub storage before the store module reads its initial projects.
vi.hoisted(() => {
  const data = new Map<string, string>([
    ["dotbot.openedWorkspaces", JSON.stringify(["/legacy/project"])],
  ]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  });
});

import { useWorkspaceStore } from "../src/renderer/stores/workspace-store";

describe("workspace store", () => {
  it("keeps projects saved under the pre-rename storage key", () => {
    expect(useWorkspaceStore.getState().projects).toEqual(["/legacy/project"]);
  });
});
