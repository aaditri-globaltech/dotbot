import type { GitStatus } from "@dotbot/source-control";
import { describe, expect, it } from "vitest";
import { gitMarkers } from "../src/renderer/components/panels/git-markers";

/** Build porcelain status entries from a path and its two status columns. */
function status(...entries: Array<[string, string]>): GitStatus {
  return {
    cwd: "/repo",
    root: "/repo",
    branch: "main",
    changes: entries.map(([path, code]) => ({
      path,
      indexStatus: code[0] ?? " ",
      worktreeStatus: code[1] ?? " ",
    })),
  };
}

describe("gitMarkers", () => {
  it("maps porcelain codes to the single letters shown in the tree", () => {
    const markers = gitMarkers(
      status(
        ["new.md", "??"],
        ["edited.ts", " M"],
        ["both.ts", "MM"],
        ["added.ts", "A "],
        ["gone.ts", " D"],
        ["moved.ts", "R "],
      ),
    );

    expect(markers.files.get("new.md")).toBe("U");
    expect(markers.files.get("edited.ts")).toBe("M");
    expect(markers.files.get("both.ts")).toBe("M");
    expect(markers.files.get("added.ts")).toBe("A");
    expect(markers.files.get("gone.ts")).toBe("D");
    expect(markers.files.get("moved.ts")).toBe("R");
  });

  it("collects every directory that holds a change", () => {
    const markers = gitMarkers(
      status(["src/deep/b.ts", " M"], ["src/a.ts", " M"], ["root.md", "??"]),
    );

    expect([...markers.directories].sort()).toEqual(["src", "src/deep"]);
    expect(markers.files.has("root.md")).toBe(true);
  });

  it("returns nothing for a missing or failed status", () => {
    expect(gitMarkers(undefined).files.size).toBe(0);
    expect(gitMarkers(undefined).directories.size).toBe(0);
    expect(gitMarkers({ ...status(), error: "not a repo" }).files.size).toBe(0);
  });
});
