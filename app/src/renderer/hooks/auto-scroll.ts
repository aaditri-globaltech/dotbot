import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";

/** Minimum scroll metrics required by the auto-follow helpers. */
export type ScrollMetrics = Pick<
  HTMLElement,
  "clientHeight" | "scrollHeight" | "scrollTop"
>;

/** Allow one pixel of layout rounding when deciding whether to follow. */
const BOTTOM_TOLERANCE = 1;
/** Cover the browser scroll event that follows direct user input. */
const USER_SCROLL_INTENT_MS = 250;

/** Return whether an element is within the bottom tolerance of its content. */
export function isAtBottom(
  element: ScrollMetrics,
  tolerance = BOTTOM_TOLERANCE,
): boolean {
  return (
    Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) <=
    tolerance
  );
}

/** Scroll an element to the last visible line of its content. */
export function scrollToBottom(element: ScrollMetrics): void {
  element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
}

/**
 * Keep a scroll container at the bottom while streamed content changes.
 * Layout changes are observed separately from direct wheel, touch, and keyboard
 * input so streaming does not look like a user scroll. Changing `resetKey`
 * starts a newly selected session at the bottom again.
 */
export function createAutoScroll<T extends ScrollMetrics>(
  content: Accessor<unknown>,
  resetKey?: Accessor<unknown>,
) {
  let element: T | undefined;
  const [isFollowing, setIsFollowing] = createSignal(true);
  let following = true;
  let previousKey: unknown;
  let hasPreviousKey = false;
  let scrollFrame: number | undefined;
  let microtaskScheduled = false;
  let mutationObserver: MutationObserver | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let resizeTargets = new Set<Element>();
  let previousMetrics: ScrollMetrics | undefined;
  let contentChangePending = false;
  let resetPending = false;
  let userScrollIntentUntil = 0;
  let interactionElement: HTMLElement | undefined;
  let disposed = false;

  const setFollowing = (value: boolean) => {
    following = value;
    setIsFollowing(value);
  };

  const rememberMetrics = (target: ScrollMetrics) => {
    previousMetrics = {
      clientHeight: target.clientHeight,
      scrollHeight: target.scrollHeight,
      scrollTop: target.scrollTop,
    };
  };

  const markUserScrollIntent = () => {
    userScrollIntentUntil = Date.now() + USER_SCROLL_INTENT_MS;
  };

  const markKeyboardScrollIntent = (event: KeyboardEvent) => {
    if (
      ["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp"].includes(
        event.key,
      ) ||
      event.key === " "
    ) {
      userScrollIntentUntil = Date.now() + USER_SCROLL_INTENT_MS;
    }
  };

  const detachInteractionListeners = () => {
    if (!interactionElement) return;
    interactionElement.removeEventListener("wheel", markUserScrollIntent);
    interactionElement.removeEventListener("touchmove", markUserScrollIntent);
    interactionElement.removeEventListener("keydown", markKeyboardScrollIntent);
    interactionElement = undefined;
  };

  const scheduleScroll = () => {
    if (scrollFrame !== undefined || microtaskScheduled) return;

    const settle = () => {
      if (disposed) return;
      if (following && element) scrollToBottom(element);
      if (element) rememberMetrics(element);
      contentChangePending = false;
      resetPending = false;
    };

    if (typeof requestAnimationFrame === "function") {
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = undefined;
        settle();
      });
    } else {
      microtaskScheduled = true;
      queueMicrotask(() => {
        microtaskScheduled = false;
        settle();
      });
    }
  };

  const onScroll = (event: Event & { currentTarget: T }) => {
    const target = event.currentTarget;
    if (!target) return;

    if (resetPending) {
      rememberMetrics(target);
      return;
    }

    const recentUserScroll = Date.now() <= userScrollIntentUntil;
    const contentChanged =
      previousMetrics !== undefined &&
      Math.abs(target.scrollTop - previousMetrics.scrollTop) <= 1 &&
      (target.clientHeight !== previousMetrics.clientHeight ||
        target.scrollHeight !== previousMetrics.scrollHeight);
    const layoutScroll =
      following &&
      !recentUserScroll &&
      (contentChangePending || contentChanged);
    if (layoutScroll) scheduleScroll();
    else setFollowing(isAtBottom(target));
    rememberMetrics(target);
  };

  const refreshResizeTargets = (target: T) => {
    if (
      !resizeObserver ||
      typeof Element === "undefined" ||
      !(target instanceof Element)
    ) {
      return;
    }

    const nextTargets = new Set<Element>([
      target,
      ...Array.from(target.children),
    ]);
    for (const previousTarget of resizeTargets) {
      if (!nextTargets.has(previousTarget)) {
        resizeObserver.unobserve(previousTarget);
      }
    }
    for (const nextTarget of nextTargets) {
      if (!resizeTargets.has(nextTarget)) resizeObserver.observe(nextTarget);
    }
    resizeTargets = nextTargets;
  };

  const setElement = (value: T | undefined) => {
    element = value;
    if (value) rememberMetrics(value);
    mutationObserver?.disconnect();
    mutationObserver = undefined;
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    resizeTargets.clear();
    detachInteractionListeners();

    if (
      value &&
      typeof ResizeObserver !== "undefined" &&
      typeof Element !== "undefined" &&
      value instanceof Element
    ) {
      const observer = new ResizeObserver(() => {
        contentChangePending = true;
        scheduleScroll();
      });
      resizeObserver = observer;
      refreshResizeTargets(value);
    }
    if (
      value &&
      typeof MutationObserver !== "undefined" &&
      typeof Element !== "undefined" &&
      value instanceof Element
    ) {
      const observer = new MutationObserver(() => {
        contentChangePending = true;
        refreshResizeTargets(value);
        scheduleScroll();
      });
      mutationObserver = observer;
      observer.observe(value, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
    if (
      value &&
      typeof HTMLElement !== "undefined" &&
      value instanceof HTMLElement
    ) {
      interactionElement = value;
      value.addEventListener("wheel", markUserScrollIntent, { passive: true });
      value.addEventListener("touchmove", markUserScrollIntent, {
        passive: true,
      });
      value.addEventListener("keydown", markKeyboardScrollIntent);
    }
    scheduleScroll();
  };

  // Runs after every content change: a new session resets follow mode, and
  // streamed content schedules another bottom scroll.
  createEffect(() => {
    // Reading both accessors is what subscribes this effect to them.
    content();
    const key = resetKey?.();
    if (!hasPreviousKey || !Object.is(key, previousKey)) {
      setFollowing(true);
      resetPending = true;
      previousKey = key;
      hasPreviousKey = true;
    }
    contentChangePending = true;
    scheduleScroll();
  });

  onCleanup(() => {
    disposed = true;
    mutationObserver?.disconnect();
    resizeObserver?.disconnect();
    detachInteractionListeners();
    if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
  });

  const jumpToBottom = () => {
    resetPending = false;
    setFollowing(true);
    if (element) {
      scrollToBottom(element);
      rememberMetrics(element);
    }
  };

  return {
    isFollowing,
    jumpToBottom,
    onScroll,
    setElement,
  };
}
