/**
 * Coverage for the capability surface exposed through AgentManager:
 * extension bindings, the safe extension theme, and the session capability
 * methods (naming, compaction, stats, bash, tools, custom messages, queue).
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fauxAssistantMessage, fauxText } from "@earendil-works/pi-ai";
import {
  type AgentSession,
  type CreateAgentSessionOptions,
  type CreateAgentSessionResult,
  createAgentSession,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AgentManager } from "../src/agent-manager";
import { collectEvents, createFauxRuntime, stubSession } from "./helpers";

const workspace = mkdtempSync(join(tmpdir(), "dotbot-capabilities-test-"));

let manager: AgentManager | undefined;

beforeEach(() => {
  manager?.stopAll();
  manager = undefined;
});

afterAll(() => {
  manager?.stopAll();
});

type Bindings = Parameters<AgentSession["bindExtensions"]>[0];

/** Open a session backed by a stub so bindings can be captured directly. */
async function openStubSession(options?: {
  overrides?: Partial<AgentSession>;
  onShutdown?: () => void;
}) {
  const { runtime } = await createFauxRuntime();
  let bindings: Bindings | undefined;
  const stub = stubSession({
    ...options?.overrides,
    bindExtensions: async (value: Bindings) => {
      bindings = value;
    },
  });
  const collector = collectEvents();
  const sessions = new AgentManager({
    onEvent: collector.onEvent,
    modelRuntime: runtime,
    createSession: async () =>
      ({ session: stub }) as unknown as CreateAgentSessionResult,
    ...(options?.onShutdown ? { onShutdown: options.onShutdown } : {}),
  });
  manager = sessions;
  const created = await sessions.create(workspace);
  await sessions.open(created.id);
  if (!bindings) throw new Error("Extension bindings were not bound");
  return { manager: sessions, collector, created, bindings, stub };
}

/** Start a manager whose real sessions use the faux provider. */
async function startRealManager() {
  const { runtime, faux } = await createFauxRuntime();
  faux.setResponses([fauxAssistantMessage([fauxText("hello from faux")])]);
  const collector = collectEvents();
  let session: AgentSession | undefined;
  manager = new AgentManager({
    onEvent: collector.onEvent,
    modelRuntime: runtime,
    createSession: async (sessionOptions) => {
      const result = await createAgentSession({
        ...sessionOptions,
        model: faux.getModel(),
      });
      session = result.session;
      return result;
    },
  });
  return { manager, faux, collector, getSession: () => session };
}

describe("AgentManager extension bindings", () => {
  it("reports extension handler errors as extension_error events", async () => {
    const {
      manager: sessions,
      collector,
      created,
      bindings,
    } = await openStubSession();

    bindings.onError?.({
      extensionPath: "/tmp/ext.ts",
      event: "tool_call",
      error: "handler exploded",
    });

    expect(
      collector.events.find((event) => event.type === "extension_error"),
    ).toEqual({
      type: "extension_error",
      sessionId: created.id,
      extensionPath: "/tmp/ext.ts",
      event: "tool_call",
      message: "handler exploded",
    });
    sessions.stopAll();
  });

  it("routes extension shutdown requests to onShutdown", async () => {
    let shutdowns = 0;
    const { manager: sessions, bindings } = await openStubSession({
      onShutdown: () => {
        shutdowns += 1;
      },
    });

    bindings.shutdownHandler?.();

    expect(shutdowns).toBe(1);
    sessions.stopAll();
  });

  it("aborts the session through the extension abort handler", async () => {
    let aborts = 0;
    const { manager: sessions, bindings } = await openStubSession({
      overrides: {
        abort: async () => {
          aborts += 1;
        },
      },
    });

    bindings.abortHandler?.();

    expect(aborts).toBe(1);
    sessions.stopAll();
  });

  it("delegates waitForIdle and reload and rejects session replacement", async () => {
    let waited = 0;
    let reloaded = 0;
    const { manager: sessions, bindings } = await openStubSession({
      overrides: {
        waitForIdle: async () => {
          waited += 1;
        },
        reload: async () => {
          reloaded += 1;
        },
      },
    });
    const actions = bindings.commandContextActions;
    if (!actions) throw new Error("Command context actions were not bound");

    await actions.waitForIdle();
    await actions.reload();
    expect(waited).toBe(1);
    expect(reloaded).toBe(1);

    for (const replace of [
      () => actions.newSession(),
      () => actions.fork("entry"),
      () => actions.navigateTree("entry"),
      () => actions.switchSession("/tmp/session.jsonl"),
    ]) {
      await expect(replace()).rejects.toThrow(
        "Session replacement is not supported yet",
      );
    }
    sessions.stopAll();
  });

  it("gives extensions a safe theme that never throws", async () => {
    const { manager: sessions, bindings } = await openStubSession();
    const theme = bindings.uiContext?.theme;
    if (!theme) throw new Error("Extension UI context was not bound");

    expect(theme.fg("accent", "text")).toBe("text");
    expect(theme.bg("selectedBg", "text")).toBe("text");
    expect(theme.bold("text")).toBe("text");
    expect(theme.italic("text")).toBe("text");
    expect(theme.underline("text")).toBe("text");
    expect(theme.inverse("text")).toBe("text");
    expect(theme.strikethrough("text")).toBe("text");
    expect(theme.getFgAnsi("accent")).toBe("");
    expect(theme.getBgAnsi("selectedBg")).toBe("");
    expect(theme.getColorMode()).toBe("truecolor");
    expect(theme.getThinkingBorderColor("low")("text")).toBe("text");
    expect(theme.getBashModeBorderColor()("text")).toBe("text");
    sessions.stopAll();
  });
});

describe("AgentManager session start metadata", () => {
  it("reports startup for a new session and resume for a persisted one", async () => {
    const { runtime, faux } = await createFauxRuntime();
    const reasons: Array<string | undefined> = [];
    const collector = collectEvents();
    const sessions = new AgentManager({
      onEvent: collector.onEvent,
      modelRuntime: runtime,
      createSession: (sessionOptions) => {
        reasons.push(sessionOptions?.sessionStartEvent?.reason);
        return createAgentSession({
          ...sessionOptions,
          model: faux.getModel(),
        });
      },
    });

    const created = await sessions.create(workspace);
    await sessions.open(created.id);
    expect(reasons.at(-1)).toBe("startup");

    await sessions.prompt({ sessionId: created.id, message: "persist me" });
    await collector.waitFor(
      (event) =>
        event.type === "session_activity" &&
        event.event.type === "agent_settled",
    );
    sessions.stopAll();

    const { runtime: freshRuntime, faux: freshFaux } =
      await createFauxRuntime();
    const fresh = new AgentManager({
      modelRuntime: freshRuntime,
      createSession: (sessionOptions) => {
        reasons.push(sessionOptions?.sessionStartEvent?.reason);
        return createAgentSession({
          ...sessionOptions,
          model: freshFaux.getModel(),
        });
      },
    });
    const persisted = (await fresh.list()).find(
      (session) => session.id === created.id,
    );
    if (!persisted) throw new Error("Persisted session was not listed");
    await fresh.open(persisted.id);
    expect(reasons.at(-1)).toBe("resume");
    fresh.stopAll();
  });
});

describe("AgentManager session lifecycle capabilities", () => {
  it("sets a session name through Pi", async () => {
    const names: string[] = [];
    const { manager: sessions, created } = await openStubSession({
      overrides: {
        setSessionName: (name: string) => {
          names.push(name);
        },
      },
    });

    await sessions.setSessionName({ sessionId: created.id, name: "Refactor" });

    expect(names).toEqual(["Refactor"]);
    sessions.stopAll();
  });

  it("rejects an empty session name", async () => {
    const { manager: sessions, created } = await openStubSession();
    await expect(
      sessions.setSessionName({ sessionId: created.id, name: "   " }),
    ).rejects.toThrow("Session name is required");
    sessions.stopAll();
  });

  it("compacts and aborts through Pi", async () => {
    let instructions: string | undefined;
    let aborts = 0;
    const { manager: sessions, created } = await openStubSession({
      overrides: {
        compact: async (value?: string) => {
          instructions = value;
          return { summary: "sum", firstKeptEntryId: "e1", tokensBefore: 5 };
        },
        abortCompaction: () => {
          aborts += 1;
        },
      },
    });

    await expect(
      sessions.compact({ sessionId: created.id, customInstructions: "brief" }),
    ).resolves.toEqual({
      summary: "sum",
      firstKeptEntryId: "e1",
      tokensBefore: 5,
    });
    sessions.abortCompaction(created.id);

    expect(instructions).toBe("brief");
    expect(aborts).toBe(1);
    sessions.stopAll();
  });

  it("returns stats and context usage from a running session", async () => {
    const { manager: sessions, created } = await openStubSession({
      overrides: {
        getContextUsage: () => ({
          tokens: 10,
          contextWindow: 100,
          percent: 10,
        }),
      },
    });

    expect(sessions.getSessionStats(created.id)?.sessionId).toBe(
      "stub-session",
    );
    expect(sessions.getContextUsage(created.id)).toEqual({
      tokens: 10,
      contextWindow: 100,
      percent: 10,
    });
    sessions.stopAll();
  });

  it("reports stats for a running faux session", async () => {
    const { manager: sessions } = await startRealManager();
    const created = await sessions.create(workspace);
    await sessions.open(created.id);

    const stats = sessions.getSessionStats(created.id);
    expect(stats?.sessionId).toBe(created.id);
    expect(stats?.totalMessages).toBe(0);
    sessions.stopAll();
  });

  it("reports context usage for a running faux session", async () => {
    const { manager: sessions } = await startRealManager();
    const created = await sessions.create(workspace);
    await sessions.open(created.id);

    expect(sessions.getContextUsage(created.id)).toEqual({
      tokens: 0,
      contextWindow: 128000,
      percent: 0,
    });
    sessions.stopAll();
  });

  it("names a running faux session and updates the summary", async () => {
    const { manager: sessions, collector } = await startRealManager();
    const created = await sessions.create(workspace);
    await sessions.open(created.id);

    await sessions.setSessionName({ sessionId: created.id, name: "Refactor" });
    await collector.waitFor(
      (event) =>
        event.type === "session_update" &&
        event.session.id === created.id &&
        event.session.name === "Refactor",
    );

    const listed = (await sessions.list()).find(
      (session) => session.id === created.id,
    );
    expect(listed?.title).toBe("Refactor");
    sessions.stopAll();
  });

  it("does not start a session for stats, context usage, or compaction aborts", async () => {
    const { runtime } = await createFauxRuntime();
    let started = 0;
    const sessions = new AgentManager({
      modelRuntime: runtime,
      createSession: async () => {
        started += 1;
        return {
          session: stubSession(),
        } as unknown as CreateAgentSessionResult;
      },
    });
    const created = await sessions.create(workspace);

    expect(sessions.getSessionStats(created.id)).toBeUndefined();
    expect(sessions.getContextUsage(created.id)).toBeUndefined();
    sessions.abortCompaction(created.id);

    expect(started).toBe(0);
    sessions.stopAll();
  });

  it("starts a created session for a write without an explicit open", async () => {
    const names: string[] = [];
    const { runtime } = await createFauxRuntime();
    const sessions = new AgentManager({
      modelRuntime: runtime,
      createSession: async () =>
        ({
          session: stubSession({
            setSessionName: (name: string) => {
              names.push(name);
            },
          }),
        }) as unknown as CreateAgentSessionResult,
    });
    const created = await sessions.create(workspace);

    await sessions.setSessionName({
      sessionId: created.id,
      name: "Opened by write",
    });

    expect(names).toEqual(["Opened by write"]);
    const listed = (await sessions.list()).find(
      (session) => session.id === created.id,
    );
    expect(listed?.active).toBe(true);
    sessions.stopAll();
  });
});

describe("AgentManager prompt images and bash", () => {
  it("passes valid images to Pi", async () => {
    let received: unknown;
    const { manager: sessions, created } = await openStubSession({
      overrides: {
        prompt: async (_text, options) => {
          received = options;
        },
      },
    });
    const images = [{ type: "image", data: "abc", mimeType: "image/png" }];

    await sessions.prompt({ sessionId: created.id, message: "look", images });

    expect(received).toEqual({ images });
    sessions.stopAll();
  });

  it("rejects a malformed image before starting a session", async () => {
    const { runtime } = await createFauxRuntime();
    let started = 0;
    const sessions = new AgentManager({
      modelRuntime: runtime,
      createSession: async () => {
        started += 1;
        return {
          session: stubSession(),
        } as unknown as CreateAgentSessionResult;
      },
    });
    const created = await sessions.create(workspace);

    await expect(
      sessions.prompt({
        sessionId: created.id,
        message: "look",
        images: [{ type: "image", data: "", mimeType: "image/png" }],
      }),
    ).rejects.toThrow("Prompt image is invalid");
    expect(started).toBe(0);
    sessions.stopAll();
  });

  it("runs bash through Pi and returns the result", async () => {
    let command: string | undefined;
    let exclude: boolean | undefined;
    const { manager: sessions, created } = await openStubSession({
      overrides: {
        executeBash: async (value: string, _chunk, options) => {
          command = value;
          exclude = options?.excludeFromContext;
          return {
            output: "ok",
            exitCode: 0,
            cancelled: false,
            truncated: false,
          };
        },
      },
    });

    await expect(
      sessions.executeBash({
        sessionId: created.id,
        command: "echo ok",
        excludeFromContext: true,
      }),
    ).resolves.toEqual({
      output: "ok",
      exitCode: 0,
      cancelled: false,
      truncated: false,
    });
    expect(command).toBe("echo ok");
    expect(exclude).toBe(true);
    sessions.stopAll();
  });

  it("rejects an empty bash command", async () => {
    const { manager: sessions, created } = await openStubSession();
    await expect(
      sessions.executeBash({ sessionId: created.id, command: "  " }),
    ).rejects.toThrow("Bash command is required");
    sessions.stopAll();
  });

  it("aborts bash on the running session", async () => {
    let aborts = 0;
    const { manager: sessions, created } = await openStubSession({
      overrides: {
        abortBash: () => {
          aborts += 1;
        },
      },
    });

    sessions.abortBash(created.id);
    expect(aborts).toBe(1);
    sessions.stopAll();
  });
});

describe("AgentManager tool selection", () => {
  it("applies create options when the session starts", async () => {
    const { runtime } = await createFauxRuntime();
    let captured: CreateAgentSessionOptions | undefined;
    const sessions = new AgentManager({
      modelRuntime: runtime,
      createSession: async (sessionOptions) => {
        captured = sessionOptions;
        return {
          session: stubSession(),
        } as unknown as CreateAgentSessionResult;
      },
    });
    const customTool = { name: "fake" } as unknown as ToolDefinition;

    const created = await sessions.create(workspace, {
      tools: ["read"],
      excludeTools: ["bash"],
      noTools: "all",
      customTools: [customTool],
    });
    await sessions.open(created.id);

    expect(captured?.tools).toEqual(["read"]);
    expect(captured?.excludeTools).toEqual(["bash"]);
    expect(captured?.noTools).toBe("all");
    expect(captured?.customTools).toEqual([customTool]);

    const empty = await sessions.create(workspace, { tools: [] });
    await sessions.open(empty.id);
    expect(captured?.tools).toEqual([]);
    sessions.stopAll();
  });

  it("rejects malformed create options", async () => {
    const { runtime } = await createFauxRuntime();
    const sessions = new AgentManager({ modelRuntime: runtime });

    await expect(sessions.create(workspace, { tools: "read" })).rejects.toThrow(
      "Session options are invalid",
    );
    await expect(
      sessions.create(workspace, { noTools: "some" }),
    ).rejects.toThrow("Session options are invalid");
    sessions.stopAll();
  });

  it("replaces the active tools on a running session", async () => {
    let active: string[] | undefined;
    const { manager: sessions, created } = await openStubSession({
      overrides: {
        setActiveToolsByName: (names: string[]) => {
          active = names;
        },
      },
    });

    await sessions.setActiveTools({ sessionId: created.id, tools: ["read"] });
    expect(active).toEqual(["read"]);

    await sessions.setActiveTools({ sessionId: created.id, tools: [] });
    expect(active).toEqual([]);
    sessions.stopAll();
  });

  it("replaces the active tools on a running faux session", async () => {
    const { manager: sessions, getSession } = await startRealManager();
    const created = await sessions.create(workspace);
    await sessions.open(created.id);

    await sessions.setActiveTools({ sessionId: created.id, tools: ["read"] });
    expect(getSession()?.getActiveToolNames()).toEqual(["read"]);
    sessions.stopAll();
  });

  it("rejects a malformed tool selection", async () => {
    const { manager: sessions, created } = await openStubSession();
    await expect(
      sessions.setActiveTools({ sessionId: created.id, tools: [""] }),
    ).rejects.toThrow("Tool selection is invalid");
    sessions.stopAll();
  });
});

describe("AgentManager custom messages and queue", () => {
  it("sends a custom message with display defaulting to true", async () => {
    let sent: unknown;
    let options: unknown;
    const { manager: sessions, created } = await openStubSession({
      overrides: {
        sendCustomMessage: async (message, delivery) => {
          sent = message;
          options = delivery;
        },
      },
    });

    await sessions.sendCustomMessage({
      sessionId: created.id,
      message: { customType: "note", content: "remember this" },
      triggerTurn: true,
    });

    expect(sent).toEqual({
      customType: "note",
      content: "remember this",
      display: true,
      details: undefined,
    });
    expect(options).toEqual({ triggerTurn: true });
    sessions.stopAll();
  });

  it("rejects malformed custom messages", async () => {
    const { manager: sessions, created } = await openStubSession();

    await expect(
      sessions.sendCustomMessage({
        sessionId: created.id,
        message: { customType: "", content: "x" },
      }),
    ).rejects.toThrow("Custom message type is required");
    await expect(
      sessions.sendCustomMessage({
        sessionId: created.id,
        message: { customType: "note", content: "  " },
      }),
    ).rejects.toThrow("Custom message content is invalid");
    await expect(
      sessions.sendCustomMessage({
        sessionId: created.id,
        message: { customType: "note", content: "x" },
        deliverAs: "later",
      }),
    ).rejects.toThrow("Custom message delivery is invalid");
    sessions.stopAll();
  });

  it("returns queue copies and clears them", async () => {
    let cleared = 0;
    const { manager: sessions, created } = await openStubSession({
      overrides: {
        getSteeringMessages: () => ["steer"],
        getFollowUpMessages: () => ["follow"],
        clearQueue: () => {
          cleared += 1;
          return { steering: ["steer"], followUp: ["follow"] };
        },
      },
    });

    const queue = sessions.getQueue(created.id);
    expect(queue).toEqual({
      steering: ["steer"],
      followUp: ["follow"],
      pendingCount: 0,
    });
    expect(sessions.clearQueue(created.id)).toEqual({
      steering: ["steer"],
      followUp: ["follow"],
    });
    expect(cleared).toBe(1);
    sessions.stopAll();
  });

  it("injects a custom message into a running faux session", async () => {
    const { manager: sessions } = await startRealManager();
    const created = await sessions.create(workspace);
    await sessions.open(created.id);

    await sessions.sendCustomMessage({
      sessionId: created.id,
      message: { customType: "note", content: "remember this" },
    });
    expect(sessions.getQueue(created.id)).toEqual({
      steering: [],
      followUp: [],
      pendingCount: 0,
    });
    sessions.stopAll();
  });

  it("clears the queue on a running faux session", async () => {
    const { manager: sessions } = await startRealManager();
    const created = await sessions.create(workspace);
    await sessions.open(created.id);

    expect(sessions.clearQueue(created.id)).toEqual({
      steering: [],
      followUp: [],
    });
    sessions.stopAll();
  });

  it("returns empty queue reads without starting a session", async () => {
    const { runtime } = await createFauxRuntime();
    let started = 0;
    const sessions = new AgentManager({
      modelRuntime: runtime,
      createSession: async () => {
        started += 1;
        return {
          session: stubSession(),
        } as unknown as CreateAgentSessionResult;
      },
    });
    const created = await sessions.create(workspace);

    expect(sessions.getQueue(created.id)).toEqual({
      steering: [],
      followUp: [],
      pendingCount: 0,
    });
    expect(sessions.clearQueue(created.id)).toEqual({
      steering: [],
      followUp: [],
    });
    await expect(
      sessions.sendCustomMessage({
        sessionId: created.id,
        message: { customType: "note", content: "  " },
      }),
    ).rejects.toThrow("Custom message content is invalid");
    expect(started).toBe(0);
    sessions.stopAll();
  });
});
