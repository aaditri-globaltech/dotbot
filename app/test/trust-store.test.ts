/** Trust prompts and decisions must survive renders and follow agent events. */

import type { AgentManagerEvent, TrustRequest } from "@dotbot/agent-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  respondTrust: vi.fn(),
  onEvent: vi.fn(),
  getDefault: vi.fn(),
  setDefault: vi.fn(),
  list: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("../src/renderer/api", () => ({
  api: {
    agent: {
      respondTrust: mocks.respondTrust,
      onEvent: mocks.onEvent,
    },
    trust: {
      getDefault: mocks.getDefault,
      setDefault: mocks.setDefault,
      list: mocks.list,
      revoke: mocks.revoke,
    },
  },
}));

import { createTrustStore } from "../src/renderer/stores/trust-store";

const request: TrustRequest = {
  id: "t1",
  method: "select",
  title: "Trust project folder?",
  options: ["Trust", "Do not trust"],
};

let store: ReturnType<typeof createTrustStore>;

beforeEach(() => {
  store = createTrustStore();
  vi.clearAllMocks();
  mocks.respondTrust.mockResolvedValue(undefined);
});

describe("trust store prompt", () => {
  it("stores a pending request and clears it after answering", async () => {
    store.applyEvent({ type: "trust_request", request });
    expect(store.state.requests).toEqual([request]);

    store.respond({
      type: "extension_ui_response",
      id: "t1",
      value: "Trust",
    });

    await vi.waitFor(() => expect(store.state.requests).toEqual([]));
    expect(mocks.respondTrust).toHaveBeenCalledWith({
      type: "extension_ui_response",
      id: "t1",
      value: "Trust",
    });
  });

  it("logs and clears the request when the answer fails", async () => {
    mocks.respondTrust.mockRejectedValue(new Error("boom"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    store.applyEvent({ type: "trust_request", request });

    store.respond({
      type: "extension_ui_response",
      id: "t1",
      cancelled: true,
    });

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(store.state.requests).toEqual([]);
    consoleError.mockRestore();
  });

  it("queues multiple requests and clears them by id", async () => {
    const second: TrustRequest = { ...request, id: "t2" };
    store.applyEvent({ type: "trust_request", request });
    store.applyEvent({ type: "trust_request", request: second });
    expect(store.state.requests).toEqual([request, second]);

    store.respond({
      type: "extension_ui_response",
      id: "t1",
      value: "Trust",
    });

    await vi.waitFor(() => expect(store.state.requests).toEqual([second]));
  });

  it("records trust updates per project", () => {
    store.applyEvent({
      type: "trust_update",
      projectDir: "/p",
      decision: false,
    });

    expect(store.state.decisions["/p"]).toBe(false);
  });

  it("applies events from the agent channel", () => {
    let listener: ((event: AgentManagerEvent) => void) | undefined;
    mocks.onEvent.mockImplementation(
      (value: (event: AgentManagerEvent) => void) => {
        listener = value;
        return () => {};
      },
    );

    const unsubscribe = store.subscribe();
    listener?.({ type: "trust_request", request });

    expect(store.state.requests).toEqual([request]);
    unsubscribe();
  });
});

describe("trust store manage data", () => {
  it("loads the default and saved decisions", async () => {
    mocks.getDefault.mockResolvedValue("never");
    mocks.list.mockResolvedValue([{ path: "/a", decision: true }]);

    await store.load();

    expect(store.state.defaultTrust).toBe("never");
    expect(store.state.entries).toEqual([{ path: "/a", decision: true }]);
    expect(store.state.error).toBeUndefined();
  });

  it("reports a load failure", async () => {
    mocks.getDefault.mockResolvedValue("ask");
    mocks.list.mockRejectedValue(new Error("Invalid trust store"));

    await store.load();

    expect(store.state.error).toBe("Invalid trust store");
  });

  it("saves the default and revokes a decision", async () => {
    mocks.setDefault.mockResolvedValue(undefined);
    mocks.revoke.mockResolvedValue(undefined);
    mocks.list.mockResolvedValue([]);

    await store.setDefault("always");
    expect(mocks.setDefault).toHaveBeenCalledWith("always");
    expect(store.state.defaultTrust).toBe("always");

    await store.revoke("/a");
    expect(mocks.revoke).toHaveBeenCalledWith("/a");
    expect(store.state.entries).toEqual([]);
  });
});
