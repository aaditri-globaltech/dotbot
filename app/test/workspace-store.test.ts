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

import { createWorkspaceStore } from "../src/renderer/stores/workspace-store";

describe("workspace store", () => {
  it("keeps projects saved under the pre-rename storage key", () => {
    const store = createWorkspaceStore();
    expect(store.state.projects).toEqual(["/legacy/project"]);
  });

  it("remembers a project once and selects it", () => {
    const store = createWorkspaceStore();
    store.selectProject("/a");
    store.selectProject("/a");
    expect(store.state.projects).toEqual(["/legacy/project", "/a"]);
    expect(store.state.selectedProject).toBe("/a");
  });

  it("survives storage that throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    });
    const store = createWorkspaceStore();
    expect(store.state.projects).toEqual([]);
    expect(() => store.selectProject("/b")).not.toThrow();
  });
});
