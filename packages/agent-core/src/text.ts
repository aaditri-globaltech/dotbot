/**
 * Tolerant JSON and text extraction shared by history compaction and the
 * renderer transcript. This module must stay free of runtime dependencies so
 * the renderer can import it without pulling the Pi runtime into the
 * browser bundle.
 */

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

export function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}

export function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((block) => {
      const record = asRecord(block);
      return record?.type === "text" && typeof record.text === "string"
        ? record.text
        : "";
    })
    .join("");
}

/** Prefer diff details used by edit tools, then text content. */
export function toolResultText(result: unknown): string {
  const record = asRecord(result);
  const diff = asRecord(record?.details)?.diff;
  return typeof diff === "string" ? diff : textFromContent(record?.content);
}
