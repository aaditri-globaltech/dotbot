/** Serializes workspace watch lifecycle changes so replacements cannot leak a watcher. */

/** Starts a directory watch and resolves with its stop function. */
type WatchStarter = (
  cwd: unknown,
  listener: (paths: string[]) => void,
  onError: (error: unknown) => void,
) => Promise<() => Promise<void>>;

type WorkspaceWatch = {
  watch: (
    cwd: unknown,
    listener: (paths: string[]) => void,
    onError: (error: unknown) => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
};

/**
 * Run watch operations in order. Concurrent requests would otherwise each start
 * a native watcher and overwrite the stop handle, leaking the earlier watcher.
 */
export function createWorkspaceWatch(start: WatchStarter): WorkspaceWatch {
  let queue: Promise<void> = Promise.resolve();
  let stopCurrent: (() => Promise<void>) | undefined;

  const enqueue = (task: () => Promise<void>) => {
    const next = queue.then(task);
    queue = next.catch(() => {});
    return next;
  };

  return {
    watch: (cwd, listener, onError) =>
      enqueue(async () => {
        await stopCurrent?.();
        stopCurrent = undefined;
        try {
          stopCurrent = await start(cwd, listener, onError);
        } catch (error) {
          onError(error);
        }
      }),
    stop: () =>
      enqueue(async () => {
        await stopCurrent?.();
        stopCurrent = undefined;
      }),
  };
}
