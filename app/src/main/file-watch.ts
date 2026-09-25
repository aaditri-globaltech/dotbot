/** Serializes file watch lifecycle changes so replacements cannot leak a watcher. */

/** Starts a directory watch and resolves with its stop function. */
type WatchStarter = (
  projectDir: unknown,
  listener: (paths: string[]) => void,
  onError: (error: unknown) => void,
) => Promise<() => Promise<void>>;

type FileWatch = {
  watch: (
    projectDir: unknown,
    listener: (paths: string[]) => void,
    onError: (error: unknown) => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
};

/**
 * Run watch operations in order. Concurrent requests would otherwise each start
 * a native watcher and overwrite the stop handle, leaking the earlier watcher.
 */
export function createFileWatch(start: WatchStarter): FileWatch {
  let queue: Promise<void> = Promise.resolve();
  let stopCurrent: (() => Promise<void>) | undefined;

  const enqueue = (operation: () => Promise<void>) => {
    const next = queue.then(operation);
    queue = next.catch(() => {});
    return next;
  };

  return {
    watch: (projectDir, listener, onError) =>
      enqueue(async () => {
        await stopCurrent?.();
        stopCurrent = undefined;
        try {
          stopCurrent = await start(projectDir, listener, onError);
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
