/** Reduce Pi history to the fields rendered by the desktop chat. */
import { asRecord, formatValue, textFromContent, toolResultText } from "./text";
import type { AgentChatItem, AgentThinkingBlock, AgentToolCall } from "./types";

function isToolCall(item: AgentChatItem): item is AgentToolCall {
  return "kind" in item && item.kind === "tool";
}

/** Convert persisted messages into the smaller set of UI chat items. */
export function compactAgentHistory(messages: unknown): AgentChatItem[] {
  if (!Array.isArray(messages)) return [];

  const result: AgentChatItem[] = [];
  const toolIndexes = new Map<string, number>();

  for (const [index, message] of messages.entries()) {
    const record = asRecord(message);
    const role = record?.role;
    if (role !== "user" && role !== "assistant") {
      if (role !== "toolResult" || typeof record?.toolCallId !== "string") {
        continue;
      }

      const existingIndex = toolIndexes.get(record.toolCallId);
      const output = toolResultText(record);
      const status = record.isError === true ? "error" : "done";
      if (existingIndex !== undefined && isToolCall(result[existingIndex])) {
        result[existingIndex] = {
          ...result[existingIndex],
          output,
          status,
        };
      } else {
        result.push({
          kind: "tool",
          id: `history-tool-${record.toolCallId}`,
          name: typeof record.toolName === "string" ? record.toolName : "Tool",
          arguments: "",
          output,
          status,
        });
      }
      continue;
    }

    const content = record?.content;
    if (!Array.isArray(content)) {
      const text = textFromContent(content);
      if (text) result.push({ id: `history-${index}`, role, text });
      continue;
    }

    if (role === "user") {
      const text = textFromContent(content);
      if (text) result.push({ id: `history-${index}`, role, text });
      continue;
    }

    for (const [blockIndex, block] of content.entries()) {
      const blockRecord = asRecord(block);
      if (
        blockRecord?.type === "text" &&
        typeof blockRecord.text === "string"
      ) {
        result.push({
          id: `history-${index}-text-${blockIndex}`,
          role,
          text: blockRecord.text,
        });
        continue;
      }
      if (
        blockRecord?.type === "thinking" &&
        typeof blockRecord.thinking === "string"
      ) {
        const item: AgentThinkingBlock = {
          kind: "thinking",
          id: `history-thinking-${index}-${blockIndex}`,
          text: blockRecord.thinking,
          status: "done",
        };
        result.push(item);
        continue;
      }
      if (
        blockRecord?.type !== "toolCall" ||
        typeof blockRecord.id !== "string"
      ) {
        continue;
      }

      const item: AgentToolCall = {
        kind: "tool",
        id: `history-tool-${blockRecord.id}`,
        name: typeof blockRecord.name === "string" ? blockRecord.name : "Tool",
        arguments: formatValue(blockRecord.arguments),
        output: "",
        status: "running",
      };
      toolIndexes.set(blockRecord.id, result.length);
      result.push(item);
    }
  }

  return result;
}
