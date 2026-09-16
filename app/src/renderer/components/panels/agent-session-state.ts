/**
 * Reduce the agent's streamed session events into stable chat items and control
 * selections. The maps below preserve identity while message, thinking, and
 * tool events arrive in separate chunks.
 */

import type {
  AgentChatItem,
  AgentErrorNotice,
  AgentEvent,
  AgentModel,
  AgentSessionState,
  AgentThinkingBlock,
  AgentThinkingLevel,
  AgentToolCall,
} from "@aria/agent-core";
import {
  asRecord,
  formatValue,
  textFromContent,
  toolResultText,
} from "@aria/agent-core/text";

/** All renderer state associated with one selected session. */
export type SessionClientState = {
  messages: AgentChatItem[];
  models: AgentModel[];
  selectedModel: string;
  thinkingLevels: AgentThinkingLevel[];
  thinkingLevel: AgentThinkingLevel;
  draft: string;
  assistantCounter: number;
  thinkingCounter: number;
  currentAssistantId?: string;
  currentAssistantHasText: boolean;
  thinkingIds: Map<string, string>;
  toolAliases: Map<string, string>;
};

/** Create an empty state before the first history response arrives. */
export function createSessionClientState(): SessionClientState {
  return {
    messages: [],
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

export function isToolCall(item: AgentChatItem): item is AgentToolCall {
  return "kind" in item && item.kind === "tool";
}

export function isThinking(item: AgentChatItem): item is AgentThinkingBlock {
  return "kind" in item && item.kind === "thinking";
}

export function isErrorNotice(item: AgentChatItem): item is AgentErrorNotice {
  return "kind" in item && item.kind === "error";
}

/** Use the same provider/id key for select values and SDK updates. */
export function modelKey(model: AgentModel) {
  return `${model.provider}/${model.id}`;
}

/** Apply the manager's model and thinking selections. */
export function applySessionState(
  state: SessionClientState,
  sessionState: AgentSessionState,
): SessionClientState {
  return {
    ...state,
    models: sessionState.models,
    selectedModel: sessionState.selectedModel,
    thinkingLevel: sessionState.thinkingLevel,
    thinkingLevels: sessionState.thinkingLevels,
  };
}

/** Apply one agent event immutably so React can refresh the selected session. */
export function applySessionEvent(
  state: SessionClientState,
  event: AgentEvent,
): SessionClientState {
  // Session failures are shown inline in the transcript.
  if (event.type === "error") {
    const notice: AgentErrorNotice = {
      kind: "error",
      id: crypto.randomUUID(),
      text: event.message,
    };
    return { ...state, messages: [...state.messages, notice] };
  }

  // Clone maps because their contents are mutated while the outer state stays immutable.
  const next: SessionClientState = {
    ...state,
    thinkingIds: new Map(state.thinkingIds),
    toolAliases: new Map(state.toolAliases),
  };

  const setMessages = (
    update: (messages: AgentChatItem[]) => AgentChatItem[],
  ) => {
    next.messages = update(next.messages);
  };

  const updateThinking = (
    id: string,
    update: Partial<Pick<AgentThinkingBlock, "text" | "status">>,
  ) => {
    const index = next.messages.findIndex(
      (message) => isThinking(message) && message.id === id,
    );
    if (index === -1) {
      next.messages = [
        ...next.messages,
        {
          kind: "thinking",
          id,
          text: update.text ?? "",
          status: update.status ?? "streaming",
        },
      ];
      return;
    }

    setMessages((messages) =>
      messages.map((message, messageIndex) =>
        messageIndex === index && isThinking(message)
          ? { ...message, ...update }
          : message,
      ),
    );
  };

  const updateTool = (
    id: string,
    update: Partial<
      Pick<AgentToolCall, "name" | "arguments" | "output" | "status">
    >,
  ) => {
    const index = next.messages.findIndex(
      (message) => isToolCall(message) && message.id === id,
    );
    if (index === -1) {
      next.messages = [
        ...next.messages,
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

    setMessages((messages) =>
      messages.map((message, messageIndex) =>
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
    if (!next.messages.some((message) => message.id === id)) {
      next.messages = [...next.messages, { id, role: "assistant", text: "" }];
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
      setMessages((messages) =>
        messages.map((message) =>
          message.id === id && !isToolCall(message)
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
        const current = next.messages.find(
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
      setMessages((messages) =>
        messages.map((message) =>
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
      setMessages((messages) =>
        messages.map((entry) =>
          entry.id === id && !isToolCall(entry) ? { ...entry, text } : entry,
        ),
      );
    }
    if (next.thinkingIds.size > 0) {
      const thinkingIds = new Set(next.thinkingIds.values());
      setMessages((messages) =>
        messages.map((entry) =>
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

  return next;
}
