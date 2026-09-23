// @vitest-environment jsdom
/** Regressions found in review and manual passes: rows must keep their DOM while
 * streamed content replaces the underlying objects, the transcript must stay
 * windowed, and creating a session must not drop composer focus. */
import type { SessionSummary, TranscriptItem } from "@dotbot/agent-core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readDirectory: vi.fn(async (_projectDir: string, path: string) => {
    if (path === "") {
      return [
        { name: "src", path: "src", kind: "directory" },
        { name: "readme.md", path: "readme.md", kind: "file" },
      ];
    }
    return [{ name: "index.ts", path: "src/index.ts", kind: "file" }];
  }),
  onChanged: vi.fn(() => () => undefined),
  watch: vi.fn(async () => undefined),
  unwatch: vi.fn(async () => undefined),
  gitStatus: vi.fn(async () => undefined),
}));

vi.mock("../src/renderer/api", () => ({
  api: {
    files: {
      readDirectory: mocks.readDirectory,
      onChanged: mocks.onChanged,
      watch: mocks.watch,
      unwatch: mocks.unwatch,
    },
    git: { status: mocks.gitStatus },
  },
}));

import { ExtensionDialog } from "../src/renderer/components/panels/ExtensionDialog";
import { FileTreePanel } from "../src/renderer/components/panels/FileTreePanel";
import { SessionView } from "../src/renderer/components/panels/SessionView";
import {
  createSessionClientState,
  type SessionClientState,
} from "../src/renderer/components/panels/session-state";

afterEach(cleanup);

const session: SessionSummary = {
  id: "s1",
  projectDir: "/p",
  title: "session",
  status: "running",
  active: true,
  unread: false,
  lastActivity: "2026-01-01T00:00:00.000Z",
};

/** Render the session view with the props the workbench passes. */
function renderSessionView(
  options: {
    state?: () => SessionClientState;
    selectedSession?: () => SessionSummary | undefined;
    drafting?: () => boolean;
  } = {},
) {
  const state = options.state ?? (() => createSessionClientState());
  const selectedSession = options.selectedSession ?? (() => session);
  const drafting = options.drafting ?? (() => false);
  return render(() => (
    <SessionView
      selectedSession={selectedSession()}
      state={state()}
      drafting={drafting()}
      projects={[]}
      projectDir="/p"
      onSelectProject={() => undefined}
      onDraft={() => undefined}
      onPrompt={() => undefined}
      onRunBash={() => undefined}
      onAbort={() => undefined}
      onSetModel={() => undefined}
      onSetThinkingLevel={() => undefined}
      onRespond={() => undefined}
      onRespondTrust={() => undefined}
    />
  ));
}

const editorRequest = (id: string, prefill: string) => ({
  id,
  method: "editor" as const,
  title: "Edit the file",
  prefill,
});

describe("ExtensionDialog request replacement", () => {
  it("starts from the new request's value when the request changes", () => {
    const [request, setRequest] = createSignal(editorRequest("r1", "old text"));
    render(() => (
      <ExtensionDialog request={request()} onRespond={() => undefined} />
    ));

    expect(screen.getByRole("textbox")).toHaveProperty("value", "old text");

    setRequest(editorRequest("r2", "new text"));

    expect(screen.getByRole("textbox")).toHaveProperty("value", "new text");
  });
});

describe("FileTreePanel row identity", () => {
  it("keeps a row's element when another directory expands", async () => {
    render(() => (
      <FileTreePanel projectDir="/p" onPickProject={() => undefined} />
    ));

    const readme = (await screen.findByText("readme.md")).closest("button");
    expect(readme).not.toBeNull();

    fireEvent.click(screen.getByText("src").closest("button") as Element);
    await screen.findByText("index.ts");

    expect(screen.getByText("readme.md").closest("button")).toBe(readme);
  });
});

describe("SessionView transcript", () => {
  it("keeps a row's element when the item object is replaced", () => {
    const [transcript, setTranscript] = createSignal<TranscriptItem[]>([
      { id: "t1", role: "assistant", text: "first" },
    ]);
    renderSessionView({
      state: () => ({
        ...createSessionClientState(),
        transcript: transcript(),
      }),
    });

    const row = document.querySelector("article");
    expect(row).not.toBeNull();

    // The store hands out a new item object for every streamed delta.
    setTranscript([{ id: "t1", role: "assistant", text: "first second" }]);

    expect(screen.getByText(/first second/)).toBeTruthy();
    expect(document.querySelector("article")).toBe(row);
  });

  it("keeps the composer focused when a draft becomes a session", async () => {
    const [drafting, setDrafting] = createSignal(true);
    const [selected, setSelected] = createSignal<SessionSummary | undefined>();
    const state = () => ({ ...createSessionClientState(), draft: "hello" });
    renderSessionView({
      state,
      selectedSession: () => selected(),
      drafting: () => drafting(),
    });

    const composer = screen.getByPlaceholderText(
      "Ask Dotbot…",
    ) as HTMLTextAreaElement;
    composer.focus();
    expect(document.activeElement).toBe(composer);

    // The store opens the created session and the view leaves drafting mode.
    setSelected(session);
    setDrafting(false);

    await waitFor(() => expect(document.activeElement).toBe(composer));
  });

  it("searches the composer's model list", async () => {
    const state = () => ({
      ...createSessionClientState(),
      models: [
        { provider: "faux", id: "faux-1", name: "Faux One" },
        { provider: "other", id: "other-1", name: "Other Model" },
      ],
      selectedModel: "faux/faux-1",
    });
    // The composer disables the model control while a turn is running.
    renderSessionView({
      state,
      selectedSession: () => ({ ...session, status: "idle" }),
    });

    const trigger = screen.getByRole("button", { name: /Model/ });
    expect(trigger.textContent).toContain("Faux One");
    fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });

    // The list lives in the menu, with the filter field above it.
    const field = await screen.findByPlaceholderText("Search Model");
    const listbox = screen.getByRole("listbox");
    expect(screen.getByRole("option", { name: /Other Model/ })).toBeTruthy();

    fireEvent.input(field, { target: { value: "other" } });

    await waitFor(() =>
      expect(within(listbox).queryByText("Faux One")).toBeNull(),
    );
    expect(screen.getByRole("option", { name: /Other Model/ })).toBeTruthy();
  });

  it("renders the newest window and loads older items on demand", () => {
    const transcript: TranscriptItem[] = Array.from(
      { length: 85 },
      (_, index) => ({ id: `t${index}`, role: "assistant", text: `m${index}` }),
    );
    renderSessionView({
      state: () => ({ ...createSessionClientState(), transcript }),
    });

    expect(document.querySelectorAll("article")).toHaveLength(80);
    expect(screen.getByText("m5")).toBeTruthy();
    expect(screen.queryByText("m4")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Load older items" }));

    expect(document.querySelectorAll("article")).toHaveLength(85);
    expect(screen.getByText("m0")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Load older items" }),
    ).toBeNull();
  });
});
