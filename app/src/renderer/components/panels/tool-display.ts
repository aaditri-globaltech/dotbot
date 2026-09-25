/** Pure formatting helpers for tool cards in the agent transcript. */

import type { ToolCall } from "@dotbot/agent-core";

function parsedArguments(tool: ToolCall) {
  try {
    const value: unknown = JSON.parse(tool.arguments);
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function displayToolPath(path: string, projectDir: string) {
  const normalizedPath = path.replaceAll("\\", "/");
  const normalizedProjectDir = projectDir
    .replaceAll("\\", "/")
    .replace(/\/$/, "");
  const absolutePath =
    normalizedPath === "~" ||
    normalizedPath.startsWith("~/") ||
    normalizedPath.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalizedPath)
      ? normalizedPath
      : normalizedProjectDir
        ? `${normalizedProjectDir}/${normalizedPath}`
        : normalizedPath;
  return absolutePath.replace(/^\/home\/[^/]+/, "~");
}

export function toolPath(tool: ToolCall, projectDir: string) {
  const args = parsedArguments(tool);
  const path = args?.path ?? args?.filePath ?? args?.file_path;
  return typeof path === "string"
    ? displayToolPath(path, projectDir)
    : undefined;
}

export function bashCommand(tool: ToolCall) {
  const command = parsedArguments(tool)?.command;
  return typeof command === "string" ? command : undefined;
}

export function readToolOffset(tool: ToolCall): number {
  const offset = parsedArguments(tool)?.offset;
  return typeof offset === "number" && Number.isFinite(offset)
    ? Math.max(1, Math.trunc(offset))
    : 1;
}

/** Format a read tool's offset and limit as a compact line range. */
export function readToolRange(tool: ToolCall): string {
  const args = parsedArguments(tool);
  if (!args || (args.offset === undefined && args.limit === undefined)) {
    return "";
  }

  const offset = readToolOffset(tool);
  const limit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.max(1, Math.trunc(args.limit))
      : undefined;
  const end = limit === undefined ? undefined : offset + limit - 1;
  return `${offset}${end === undefined ? "" : `-${end}`}`;
}

/**
 * Select the text rendered below a tool card. The agent's write result only
 * reports success, so the written content from the tool arguments is preferred.
 */
export function toolOutput(tool: ToolCall) {
  if (tool.name === "write" && tool.status !== "error") {
    const content = parsedArguments(tool)?.content;
    if (typeof content === "string") return content;
  }
  return tool.output;
}

/** Map a tool file path to a Highlight.js language alias. */
function languageForFile(path: string): string {
  const filename = path.replaceAll("\\", "/").split("/").pop() ?? "";
  if (filename.toLowerCase() === "dockerfile") return "dockerfile";

  const extension = filename.split(".").pop()?.toLowerCase();
  return extension && extension !== filename ? extension : "";
}

export function toolOutputLanguage(tool: ToolCall) {
  if (tool.status === "error") return "";
  if (tool.name === "edit") return "diff";
  if (tool.name !== "read" && tool.name !== "write") return "";

  const args = parsedArguments(tool);
  const path = args?.path ?? args?.filePath ?? args?.file_path;
  return typeof path === "string" ? languageForFile(path) : "";
}

export function toolStatusColor(status: ToolCall["status"]) {
  if (status === "error") return "error";
  if (status === "done") return "success";
  return "running";
}

export function toolStatusText(status: ToolCall["status"]) {
  if (status === "error") return "Error";
  if (status === "done") return "Success";
  return "Running";
}
