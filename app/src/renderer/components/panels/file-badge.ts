/** Colored file-type badge shown at the left of a file tree row. */

/** Label and background for a family of file extensions. */
type FileBadge = {
  label: string;
  className: string;
};

const BADGES: Record<string, FileBadge> = {
  ts: { label: "TS", className: "bg-[#3178c6] text-white" },
  tsx: { label: "TS", className: "bg-[#3178c6] text-white" },
  js: { label: "JS", className: "bg-[#e8d44d] text-app" },
  jsx: { label: "JS", className: "bg-[#e8d44d] text-app" },
  json: { label: "{ }", className: "bg-[#e8d44d] text-app" },
  md: { label: "M↓", className: "bg-[#519aba] text-white" },
  html: { label: "5", className: "bg-[#e34c26] text-white" },
  css: { label: "#", className: "bg-[#563d7c] text-white" },
  py: { label: "PY", className: "bg-[#3572a5] text-white" },
  sh: { label: ">_", className: "bg-[#2f6fd0] text-white" },
  yml: { label: "Y", className: "bg-[#cb171e] text-white" },
  yaml: { label: "Y", className: "bg-[#cb171e] text-white" },
  sql: { label: "DB", className: "bg-[#4b8bb0] text-white" },
  svg: { label: "SV", className: "bg-[#a371f7] text-white" },
  png: { label: "IM", className: "bg-[#3cc060] text-app" },
  jpg: { label: "IM", className: "bg-[#3cc060] text-app" },
  webp: { label: "IM", className: "bg-[#3cc060] text-app" },
};

/** Badge for one file name, or undefined for the generic file icon. */
export function fileBadge(name: string): FileBadge | undefined {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return undefined;
  return BADGES[name.slice(dot + 1).toLowerCase()];
}
