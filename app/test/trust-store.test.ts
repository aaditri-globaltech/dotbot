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

import { useTrustStore } from "../src/renderer/stores/trust-store";

const request: TrustRequest = {
  id: "t1",
  method: "select",
  title: "Trust project folder?",
  options: ["Trust", "Do not trust"],
};

beforeEach(() => {
  useTrustStore.setState({
    requests: [],
    decisions: {},
    entries: [],
    defaultTrust: "ask",
    error: undefined,
  });
  vi.clearAllMocks();
  mocks.respondTrust.mockResolvedValue(undefined);
});

describe("trust store prompt", () => {
  it("stores a pending request and clears it after answering", async () => {
    useTrustStore.getState().applyEvent({ type: "trust_request", request });
    expect(useTrustStore.getState().requests).toEqual([request]);

    useTrustStore.getState().respond({
      type: "extension_ui_response",
      id: "t1",
      value: "Trust",
    });

    await vi.waitFor(() =>
      expect(useTrustStore.getState().requests).toEqual([]),
    );
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
    useTrustStore.getState().applyEvent({ type: "trust_request", request });

    useTrustStore.getState().respond({
      type: "extension_ui_response",
      id: "t1",
      cancelled: true,
    });

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(useTrustStore.getState().requests).toEqual([]);
    consoleError.mockRestore();
  });

  it("queues multiple requests and clears them by id", async () => {
    const second: TrustRequest = { ...request, id: "t2" };
    useTrustStore.getState().applyEvent({ type: "trust_request", request });
    useTrustStore.getState().applyEvent({
      type: "trust_request",
      request: second,
    });
    expect(useTrustStore.getState().requests).toEqual([request, second]);

    useTrustStore.getState().respond({
      type: "extension_ui_response",
      id: "t1",
      value: "Trust",
    });

    await vi.waitFor(() =>
      expect(useTrustStore.getState().requests).toEqual([second]),
    );
  });

  it("records trust updates per project", () => {
    useTrustStore.getState().applyEvent({
      type: "trust_update",
      projectDir: "/p",
      decision: false,
    });

    expect(useTrustStore.getState().decisions["/p"]).toBe(false);
  });

  it("applies events from the agent channel", () => {
    let listener: ((event: AgentManagerEvent) => void) | undefined;
    mocks.onEvent.mockImplementation(
      (value: (event: AgentManagerEvent) => void) => {
        listener = value;
        return () => {};
      },
    );

    const unsubscribe = useTrustStore.getState().subscribe();
    listener?.({ type: "trust_request", request });

    expect(useTrustStore.getState().requests).toEqual([request]);
    unsubscribe();
  });
});

describe("trust store manage data", () => {
  it("loads the default and saved decisions", async () => {
    mocks.getDefault.mockResolvedValue("never");
    mocks.list.mockResolvedValue([{ path: "/a", decision: true }]);

    await useTrustStore.getState().load();

    expect(useTrustStore.getState().defaultTrust).toBe("never");
    expect(useTrustStore.getState().entries).toEqual([
      { path: "/a", decision: true },
    ]);
    expect(useTrustStore.getState().error).toBeUndefined();
  });

  it("reports a load failure", async () => {
    mocks.getDefault.mockResolvedValue("ask");
    mocks.list.mockRejectedValue(new Error("Invalid trust store"));

    await useTrustStore.getState().load();

    expect(useTrustStore.getState().error).toBe("Invalid trust store");
  });

  it("saves the default and revokes a decision", async () => {
    mocks.setDefault.mockResolvedValue(undefined);
    mocks.revoke.mockResolvedValue(undefined);
    mocks.list.mockResolvedValue([]);

    await useTrustStore.getState().setDefault("always");
    expect(mocks.setDefault).toHaveBeenCalledWith("always");
    expect(useTrustStore.getState().defaultTrust).toBe("always");

    await useTrustStore.getState().revoke("/a");
    expect(mocks.revoke).toHaveBeenCalledWith("/a");
    expect(useTrustStore.getState().entries).toEqual([]);
  });
});
