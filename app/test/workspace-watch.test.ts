import { describe, expect, it, vi } from "vitest";
import { createWorkspaceWatch } from "../src/main/workspace-watch";

type StartCall = {
  cwd: unknown;
  resolve: (stop: () => Promise<void>) => void;
};

function createDeferredStarter() {
  const events: string[] = [];
  const calls: StartCall[] = [];
  const start = (cwd: unknown) =>
    new Promise<() => Promise<void>>((resolve) => {
      events.push(`start:${String(cwd)}`);
      calls.push({ cwd, resolve });
    });
  return { calls, events, start };
}

describe("createWorkspaceWatch", () => {
  it("stops the previous watcher before starting the next", async () => {
    const { calls, events, start } = createDeferredStarter();
    const watch = createWorkspaceWatch(start);

    const first = watch.watch(
      "a",
      () => {},
      () => {},
    );
    const second = watch.watch(
      "b",
      () => {},
      () => {},
    );

    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0]?.resolve(async () => {
      events.push("stop:a");
    });
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(events).toEqual(["start:a", "stop:a", "start:b"]);

    calls[1]?.resolve(async () => {
      events.push("stop:b");
    });
    await first;
    await second;
    await watch.stop();
    expect(events).toEqual(["start:a", "stop:a", "start:b", "stop:b"]);
  });

  it("stops a watcher that is still starting when a stop is requested", async () => {
    const { calls, events, start } = createDeferredStarter();
    const watch = createWorkspaceWatch(start);

    const started = watch.watch(
      "a",
      () => {},
      () => {},
    );
    const stopping = watch.stop();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0]?.resolve(async () => {
      events.push("stop:a");
    });

    await started;
    await stopping;
    expect(events).toEqual(["start:a", "stop:a"]);
  });

  it("reports start failures through onError", async () => {
    const errors: unknown[] = [];
    const watch = createWorkspaceWatch(async () => {
      throw new Error("boom");
    });

    await watch.watch(
      "a",
      () => {},
      (error) => errors.push(error),
    );
    expect(errors).toHaveLength(1);
  });
});
