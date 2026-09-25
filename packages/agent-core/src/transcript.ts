/** Reduce Pi messages to the fields rendered by the session transcript. */
import { asRecord, formatValue, textFromContent, toolResultText } from "./text";
import type { ThinkingBlock, ToolCall, TranscriptItem } from "./types";

function isToolCall(item: TranscriptItem): item is ToolCall {
  return "kind" in item && item.kind === "tool";
}

/** Convert persisted messages into the smaller set of UI chat items. */
export function buildTranscript(messages: unknown): TranscriptItem[] {
  if (!Array.isArray(messages)) return [];

  const result: TranscriptItem[] = [];
  const toolIndexes = new Map<string, number>();

  for (const [index, message] of messages.entries()) {
    const record = asRecord(message);
    const role = record?.role;
    if (role !== "user" && role !== "assistant") {
      if (role === "bashExecution") {
        const exitCode = record?.exitCode;
        result.push({
          kind: "bash",
          id: `transcript-bash-${index}`,
          command: typeof record?.command === "string" ? record.command : "",
          excludeFromContext: record?.excludeFromContext === true,
          output: typeof record?.output === "string" ? record.output : "",
          truncated: record?.truncated === true,
          ...(typeof record?.fullOutputPath === "string"
            ? { fullOutputPath: record.fullOutputPath }
            : {}),
          ...(typeof exitCode === "number" ? { exitCode } : {}),
          status:
            record?.cancelled === true
              ? "cancelled"
              : exitCode === 0
                ? "done"
                : "error",
        });
        continue;
      }
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
          id: `transcript-tool-${record.toolCallId}`,
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
      if (text) result.push({ id: `transcript-${index}`, role, text });
      continue;
    }

    if (role === "user") {
      const text = textFromContent(content);
      if (text) result.push({ id: `transcript-${index}`, role, text });
      continue;
    }

    for (const [blockIndex, block] of content.entries()) {
      const blockRecord = asRecord(block);
      if (
        blockRecord?.type === "text" &&
        typeof blockRecord.text === "string"
      ) {
        result.push({
          id: `transcript-${index}-text-${blockIndex}`,
          role,
          text: blockRecord.text,
        });
        continue;
      }
      if (
        blockRecord?.type === "thinking" &&
        typeof blockRecord.thinking === "string"
      ) {
        const item: ThinkingBlock = {
          kind: "thinking",
          id: `transcript-thinking-${index}-${blockIndex}`,
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

      const item: ToolCall = {
        kind: "tool",
        id: `transcript-tool-${blockRecord.id}`,
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
