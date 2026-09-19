/** Last path segment of a workspace directory, used as its display name. */
export function workspaceName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}
