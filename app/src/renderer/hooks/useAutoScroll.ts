import { type UIEvent, useCallback, useEffect, useRef, useState } from "react";

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
export function useAutoScroll<T extends ScrollMetrics>(
  _content: unknown,
  resetKey?: unknown,
) {
  const elementRef = useRef<T | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const followingRef = useRef(true);
  const previousKeyRef = useRef<unknown>(undefined);
  const hasPreviousKeyRef = useRef(false);
  const scrollFrameRef = useRef<number | undefined>(undefined);
  const microtaskScheduledRef = useRef(false);
  const mutationObserverRef = useRef<MutationObserver | undefined>(undefined);
  const resizeObserverRef = useRef<ResizeObserver | undefined>(undefined);
  const resizeTargetsRef = useRef(new Set<Element>());
  const previousMetricsRef = useRef<ScrollMetrics | undefined>(undefined);
  const contentChangePendingRef = useRef(false);
  const resetPendingRef = useRef(false);
  const userScrollIntentUntilRef = useRef(0);
  const interactionElementRef = useRef<HTMLElement | undefined>(undefined);
  const disposedRef = useRef(false);

  const setFollowing = useCallback((value: boolean) => {
    followingRef.current = value;
    setIsFollowing(value);
  }, []);

  const rememberMetrics = useCallback((target: ScrollMetrics) => {
    previousMetricsRef.current = {
      clientHeight: target.clientHeight,
      scrollHeight: target.scrollHeight,
      scrollTop: target.scrollTop,
    };
  }, []);

  const markUserScrollIntent = useCallback(() => {
    userScrollIntentUntilRef.current = Date.now() + USER_SCROLL_INTENT_MS;
  }, []);

  const markKeyboardScrollIntent = useCallback((event: KeyboardEvent) => {
    if (
      ["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp"].includes(
        event.key,
      ) ||
      event.key === " "
    ) {
      userScrollIntentUntilRef.current = Date.now() + USER_SCROLL_INTENT_MS;
    }
  }, []);

  const detachInteractionListeners = useCallback(() => {
    const element = interactionElementRef.current;
    if (!element) return;
    element.removeEventListener("wheel", markUserScrollIntent);
    element.removeEventListener("touchmove", markUserScrollIntent);
    element.removeEventListener("keydown", markKeyboardScrollIntent);
    interactionElementRef.current = undefined;
  }, [markKeyboardScrollIntent, markUserScrollIntent]);

  const scheduleScroll = useCallback(() => {
    if (scrollFrameRef.current !== undefined || microtaskScheduledRef.current) {
      return;
    }

    const settle = () => {
      if (disposedRef.current) return;
      if (followingRef.current && elementRef.current) {
        scrollToBottom(elementRef.current);
      }
      if (elementRef.current) rememberMetrics(elementRef.current);
      contentChangePendingRef.current = false;
      resetPendingRef.current = false;
    };

    if (typeof requestAnimationFrame === "function") {
      scrollFrameRef.current = requestAnimationFrame(() => {
        scrollFrameRef.current = undefined;
        settle();
      });
    } else {
      microtaskScheduledRef.current = true;
      queueMicrotask(() => {
        microtaskScheduledRef.current = false;
        settle();
      });
    }
  }, [rememberMetrics]);

  const onScroll = useCallback(
    (event: UIEvent<T>) => {
      const target = event.currentTarget;
      if (!target) return;

      if (resetPendingRef.current) {
        rememberMetrics(target);
        return;
      }

      const recentUserScroll = Date.now() <= userScrollIntentUntilRef.current;
      const previousMetrics = previousMetricsRef.current;
      const contentChanged =
        previousMetrics !== undefined &&
        Math.abs(target.scrollTop - previousMetrics.scrollTop) <= 1 &&
        (target.clientHeight !== previousMetrics.clientHeight ||
          target.scrollHeight !== previousMetrics.scrollHeight);
      const layoutScroll =
        followingRef.current &&
        !recentUserScroll &&
        (contentChangePendingRef.current || contentChanged);
      if (layoutScroll) scheduleScroll();
      else setFollowing(isAtBottom(target));
      rememberMetrics(target);
    },
    [scheduleScroll, rememberMetrics, setFollowing],
  );

  const refreshResizeTargets = useCallback((target: T) => {
    const resizeObserver = resizeObserverRef.current;
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
    for (const previousTarget of resizeTargetsRef.current) {
      if (!nextTargets.has(previousTarget)) {
        resizeObserver.unobserve(previousTarget);
      }
    }
    for (const nextTarget of nextTargets) {
      if (!resizeTargetsRef.current.has(nextTarget)) {
        resizeObserver.observe(nextTarget);
      }
    }
    resizeTargetsRef.current = nextTargets;
  }, []);

  const setElement = useCallback(
    (value: T | null) => {
      elementRef.current = value;
      if (value) rememberMetrics(value);
      mutationObserverRef.current?.disconnect();
      mutationObserverRef.current = undefined;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = undefined;
      resizeTargetsRef.current.clear();
      detachInteractionListeners();

      if (
        value &&
        typeof ResizeObserver !== "undefined" &&
        typeof Element !== "undefined" &&
        value instanceof Element
      ) {
        const observer = new ResizeObserver(() => {
          contentChangePendingRef.current = true;
          scheduleScroll();
        });
        resizeObserverRef.current = observer;
        refreshResizeTargets(value);
      }
      if (
        value &&
        typeof MutationObserver !== "undefined" &&
        typeof Element !== "undefined" &&
        value instanceof Element
      ) {
        const observer = new MutationObserver(() => {
          contentChangePendingRef.current = true;
          refreshResizeTargets(value);
          scheduleScroll();
        });
        mutationObserverRef.current = observer;
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
        interactionElementRef.current = value;
        value.addEventListener("wheel", markUserScrollIntent, {
          passive: true,
        });
        value.addEventListener("touchmove", markUserScrollIntent, {
          passive: true,
        });
        value.addEventListener("keydown", markKeyboardScrollIntent);
      }
      scheduleScroll();
    },
    [
      detachInteractionListeners,
      markKeyboardScrollIntent,
      markUserScrollIntent,
      refreshResizeTargets,
      rememberMetrics,
      scheduleScroll,
    ],
  );

  // Runs after every render: a new session resets follow mode, and streamed
  // content schedules another bottom scroll.
  useEffect(() => {
    if (
      !hasPreviousKeyRef.current ||
      !Object.is(resetKey, previousKeyRef.current)
    ) {
      setFollowing(true);
      resetPendingRef.current = true;
      previousKeyRef.current = resetKey;
      hasPreviousKeyRef.current = true;
    }
    contentChangePendingRef.current = true;
    scheduleScroll();
  });

  useEffect(
    () => () => {
      disposedRef.current = true;
      mutationObserverRef.current?.disconnect();
      resizeObserverRef.current?.disconnect();
      detachInteractionListeners();
      if (scrollFrameRef.current !== undefined) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    },
    [detachInteractionListeners],
  );

  const jumpToBottom = useCallback(() => {
    resetPendingRef.current = false;
    setFollowing(true);
    if (elementRef.current) {
      scrollToBottom(elementRef.current);
      rememberMetrics(elementRef.current);
    }
  }, [rememberMetrics, setFollowing]);

  return {
    isFollowing,
    jumpToBottom,
    onScroll,
    setElement,
  };
}
