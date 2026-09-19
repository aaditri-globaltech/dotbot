/** Last path segment of a project directory, used as its display name. */
export function projectName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}
