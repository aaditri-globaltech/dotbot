/**
 * Reduce the agent's streamed session events into stable chat items and control
 * selections. The maps below preserve identity while message, thinking, and
 * tool events arrive in separate chunks.
 */

import type {
  AgentSessionEvent,
  BashExecution,
  ErrorNotice,
  ModelSummary,
  ModelThinkingLevel,
  SessionControls,
  ThinkingBlock,
  ToolCall,
  TranscriptItem,
} from "@dotbot/agent-core";
import {
  asRecord,
  formatValue,
  textFromContent,
  toolResultText,
} from "@dotbot/agent-core/text";

/** All renderer state associated with one selected session. */
export type SessionClientState = {
  transcript: TranscriptItem[];
  models: ModelSummary[];
  selectedModel: string;
  thinkingLevels: ModelThinkingLevel[];
  thinkingLevel: ModelThinkingLevel;
  draft: string;
  assistantCounter: number;
  thinkingCounter: number;
  currentAssistantId?: string;
  currentAssistantHasText: boolean;
  thinkingIds: Map<string, string>;
  toolAliases: Map<string, string>;
  /**
   * The in-flight UI bash command, when any. `pending` means it started during
   * an agent turn and renders above the composer until it settles.
   */
  activeBash?: { id: string; pending: boolean };
};

/** Create an empty state before the first transcript response arrives. */
export function createSessionClientState(): SessionClientState {
  return {
    transcript: [],
    models: [],
    selectedModel: "",
    thinkingLevels: [],
    thinkingLevel: "medium",
    draft: "",
    assistantCounter: 0,
    thinkingCounter: 0,
    currentAssistantHasText: false,
    thinkingIds: new Map(),
    toolAliases: new Map(),
  };
}

export function isToolCall(item: TranscriptItem): item is ToolCall {
  return "kind" in item && item.kind === "tool";
}

export function isBashExecution(item: TranscriptItem): item is BashExecution {
  return "kind" in item && item.kind === "bash";
}

export function isThinking(item: TranscriptItem): item is ThinkingBlock {
  return "kind" in item && item.kind === "thinking";
}

export function isErrorNotice(item: TranscriptItem): item is ErrorNotice {
  return "kind" in item && item.kind === "error";
}

/** Use the same provider/id key for select values and SDK updates. */
export function modelKey(model: ModelSummary) {
  return `${model.provider}/${model.id}`;
}

/** Whether a composer draft is a bash command, even before it has one. */
export function isBashDraft(draft: string) {
  return draft.trimStart().startsWith("!");
}

/** Parse a composer draft starting with `!` or `!!` into a bash command. */
export function parseBashCommand(
  draft: string,
): { command: string; excludeFromContext: boolean } | undefined {
  if (!isBashDraft(draft)) return undefined;
  const text = draft.trimStart();
  const excludeFromContext = text.startsWith("!!");
  const command = text.slice(excludeFromContext ? 2 : 1).trim();
  return command ? { command, excludeFromContext } : undefined;
}

/** Apply the manager's model and thinking selections. */
export function applySessionControls(
  state: SessionClientState,
  controls: SessionControls,
): SessionClientState {
  return {
    ...state,
    models: controls.models,
    selectedModel: controls.selectedModel,
    thinkingLevel: controls.thinkingLevel,
    thinkingLevels: controls.thinkingLevels,
  };
}

/** Append an inline transcript notice for a session failure. */
export function applySessionError(
  state: SessionClientState,
  message: string,
): SessionClientState {
  const notice: ErrorNotice = {
    kind: "error",
    id: crypto.randomUUID(),
    text: message,
  };
  return { ...state, transcript: [...state.transcript, notice] };
}

/** Apply one session event immutably so React can refresh the selected session. */
export function applySessionActivity(
  state: SessionClientState,
  event: AgentSessionEvent,
): SessionClientState {
  // Clone maps because their contents are mutated while the outer state stays immutable.
  const next: SessionClientState = {
    ...state,
    thinkingIds: new Map(state.thinkingIds),
    toolAliases: new Map(state.toolAliases),
  };

  const setTranscript = (
    update: (transcript: TranscriptItem[]) => TranscriptItem[],
  ) => {
    next.transcript = update(next.transcript);
  };

  const updateThinking = (
    id: string,
    update: Partial<Pick<ThinkingBlock, "text" | "status">>,
  ) => {
    const index = next.transcript.findIndex(
      (message) => isThinking(message) && message.id === id,
    );
    if (index === -1) {
      next.transcript = [
        ...next.transcript,
        {
          kind: "thinking",
          id,
          text: update.text ?? "",
          status: update.status ?? "streaming",
        },
      ];
      return;
    }

    setTranscript((transcript) =>
      transcript.map((message, messageIndex) =>
        messageIndex === index && isThinking(message)
          ? { ...message, ...update }
          : message,
      ),
    );
  };

  const updateTool = (
    id: string,
    update: Partial<Pick<ToolCall, "name" | "arguments" | "output" | "status">>,
  ) => {
    const index = next.transcript.findIndex(
      (message) => isToolCall(message) && message.id === id,
    );
    if (index === -1) {
      next.transcript = [
        ...next.transcript,
        {
          kind: "tool",
          id,
          name: update.name ?? "Tool",
          arguments: update.arguments ?? "",
          output: update.output ?? "",
          status: update.status ?? "streaming",
        },
      ];
      return;
    }

    setTranscript((transcript) =>
      transcript.map((message, messageIndex) =>
        messageIndex === index && isToolCall(message)
          ? { ...message, ...update }
          : message,
      ),
    );
  };

  const beginAssistant = () => {
    if (!next.currentAssistantId) {
      next.assistantCounter += 1;
      next.currentAssistantId = `assistant-${next.assistantCounter}`;
    }
    const id = next.currentAssistantId;
    if (!next.transcript.some((message) => message.id === id)) {
      next.transcript = [
        ...next.transcript,
        { id, role: "assistant", text: "" },
      ];
    }
    return id;
  };

  const toolIdFor = (contentIndex: number) =>
    `tool-${next.currentAssistantId ?? `assistant-${next.assistantCounter}`}-${contentIndex}`;

  const thinkingIdFor = (contentIndex: number) => {
    const key = String(contentIndex);
    const existing = next.thinkingIds.get(key);
    if (existing) return existing;
    next.thinkingCounter += 1;
    const id = `thinking-${next.currentAssistantId ?? `assistant-${next.assistantCounter}`}-${next.thinkingCounter}`;
    next.thinkingIds.set(key, id);
    return id;
  };

  // Tool-call IDs in message events do not always match execution IDs, so keep aliases.
  const toolIdForExecution = (toolCallId: string) =>
    next.toolAliases.get(toolCallId) ?? toolCallId;

  if (event.type === "message_start") {
    if (event.message.role === "assistant") {
      next.currentAssistantId = `assistant-${next.assistantCounter + 1}`;
      next.assistantCounter += 1;
      next.currentAssistantHasText = false;
      next.thinkingIds = new Map();
    }
    return next;
  }

  if (event.type === "message_update") {
    // One assistant message can contain text, thinking, and tool-call deltas.
    const update = event.assistantMessageEvent;

    if (update.type === "text_delta") {
      const id = beginAssistant();
      next.currentAssistantHasText = true;
      const delta = update.delta;
      setTranscript((transcript) =>
        transcript.map((message) =>
          message.id === id && !isToolCall(message) && !isBashExecution(message)
            ? { ...message, text: message.text + delta }
            : message,
        ),
      );
      return next;
    }

    if (
      update.type === "thinking_start" ||
      update.type === "thinking_delta" ||
      update.type === "thinking_end"
    ) {
      const id = thinkingIdFor(update.contentIndex);
      if (update.type === "thinking_delta") {
        const current = next.transcript.find(
          (message) => isThinking(message) && message.id === id,
        );
        updateThinking(id, {
          text: `${current && isThinking(current) ? current.text : ""}${update.delta}`,
          status: "streaming",
        });
      } else if (update.type === "thinking_end") {
        updateThinking(id, { text: update.content, status: "done" });
      } else {
        updateThinking(id, { status: "streaming" });
      }
      return next;
    }

    if (
      update.type !== "toolcall_start" &&
      update.type !== "toolcall_delta" &&
      update.type !== "toolcall_end"
    ) {
      return next;
    }

    const id = toolIdFor(update.contentIndex);
    // The agent nests the partial tool call inside the assistant message content.
    const partialContent = update.partial.content[update.contentIndex];
    const partialContentRecord = asRecord(partialContent);
    const partialToolCall =
      partialContentRecord?.type === "toolCall"
        ? partialContentRecord
        : undefined;
    const toolCall =
      update.type === "toolcall_end" ? update.toolCall : undefined;
    const displayName =
      toolCall?.name ??
      (typeof partialToolCall?.name === "string"
        ? partialToolCall.name
        : "Tool");
    const partialArguments =
      partialToolCall && "arguments" in partialToolCall
        ? formatValue(partialToolCall.arguments)
        : undefined;
    updateTool(id, {
      name: displayName,
      ...(partialArguments !== undefined && partialArguments !== "{}"
        ? { arguments: partialArguments }
        : {}),
    });

    if (update.type === "toolcall_delta" && partialArguments === undefined) {
      const delta = update.delta;
      setTranscript((transcript) =>
        transcript.map((message) =>
          isToolCall(message) && message.id === id
            ? { ...message, arguments: message.arguments + delta }
            : message,
        ),
      );
    }

    if (update.type === "toolcall_end") {
      next.toolAliases.set(update.toolCall.id, id);
      const argumentsText = formatValue(update.toolCall.arguments);
      updateTool(id, {
        name: displayName,
        status: "running",
        ...(argumentsText ? { arguments: argumentsText } : {}),
      });
    }
    return next;
  }

  if (event.type === "message_end") {
    if (event.message.role !== "assistant") return next;
    const text = textFromContent(event.message.content);
    if (text && !next.currentAssistantHasText) {
      const id = beginAssistant();
      next.currentAssistantHasText = true;
      setTranscript((transcript) =>
        transcript.map((entry) =>
          entry.id === id && !isToolCall(entry) ? { ...entry, text } : entry,
        ),
      );
    }
    if (next.thinkingIds.size > 0) {
      const thinkingIds = new Set(next.thinkingIds.values());
      setTranscript((transcript) =>
        transcript.map((entry) =>
          isThinking(entry) && thinkingIds.has(entry.id)
            ? { ...entry, status: "done" }
            : entry,
        ),
      );
    }
    next.thinkingIds = new Map();
    next.currentAssistantId = undefined;
    next.currentAssistantHasText = false;
    return next;
  }

  if (event.type === "tool_execution_start") {
    const id = toolIdForExecution(event.toolCallId);
    next.toolAliases.set(event.toolCallId, id);
    updateTool(id, {
      name: event.toolName,
      arguments: formatValue(event.args),
      status: "running",
    });
    return next;
  }

  if (event.type === "tool_execution_update") {
    const id = toolIdForExecution(event.toolCallId);
    const output = toolResultText(event.partialResult);
    updateTool(id, {
      status: "running",
      name: event.toolName,
      ...(event.args !== undefined
        ? { arguments: formatValue(event.args) }
        : {}),
      ...(output ? { output } : {}),
    });
    return next;
  }

  if (event.type === "tool_execution_end") {
    const id = toolIdForExecution(event.toolCallId);
    updateTool(id, {
      output: toolResultText(event.result),
      status: event.isError ? "error" : "done",
    });
  }

  if (event.type === "bash_execution_update") {
    // Only the card created for this run receives its output. The executeBash
    // reply can settle that card before batched deltas arrive, so a settled
    // card must not be revived or duplicated.
    const index = next.transcript.findIndex(
      (message) =>
        isBashExecution(message) &&
        message.id === event.id &&
        message.status === "running",
    );
    if (index === -1) return next;

    setTranscript((transcript) =>
      transcript.map((message, messageIndex) =>
        messageIndex === index && isBashExecution(message)
          ? {
              ...message,
              output: message.output + event.delta,
              status: "running",
            }
          : message,
      ),
    );
  }

  return next;
}
