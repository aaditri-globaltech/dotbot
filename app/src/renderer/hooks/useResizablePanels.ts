/** Keep panel dimensions, collapse state, and pointer lifecycle in one hook. */
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DEFAULT_APP_KEYBINDINGS, matchesKey } from "../keybindings";

// These values preserve a usable view while allowing panels to collapse fully.
/** Minimum expanded width for the sidebar in pixels. */
const MIN_SIDE_WIDTH = 170;
/** Minimum expanded height for the bottom panel in pixels. */
const MIN_PANEL_HEIGHT = 77;
/** Collapsed side-panel width in pixels. */
export const COLLAPSED_SIDE_WIDTH = 0;
/** Collapsed bottom-panel height in pixels. */
export const COLLAPSED_PANEL_HEIGHT = 0;

const MIN_VIEW_WIDTH = 320;
const MIN_TOP_HEIGHT = 240;

/** Workbench boundary controlled by the resize hook. */
export type PanelResizeTarget = "left" | "bottom";

type ResizeAxis = "column" | "row";

type ActiveResize = {
  move: (event: PointerEvent) => void;
  stop: () => void;
};

/** Track panel sizes and provide pointer/keyboard resize handlers. */
export function useResizablePanels() {
  const [leftPanelWidth, setLeftPanelWidth] = useState(240);
  const [expandedPanelHeight, setExpandedPanelHeight] = useState(200);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const activeResizeRef = useRef<ActiveResize | undefined>(undefined);

  const leftWidth = leftCollapsed ? COLLAPSED_SIDE_WIDTH : leftPanelWidth;
  const panelHeight = panelCollapsed
    ? COLLAPSED_PANEL_HEIGHT
    : expandedPanelHeight;

  const setPanelSize = (target: PanelResizeTarget, size: number) => {
    const layout = layoutRef.current;
    if (!layout) return;

    // Clamp each panel against the minimum space reserved for the view.
    const bounds = layout.getBoundingClientRect();

    if (target === "bottom") {
      const maxHeight = Math.max(
        MIN_PANEL_HEIGHT,
        bounds.height - MIN_TOP_HEIGHT,
      );
      setPanelCollapsed(false);
      setExpandedPanelHeight(
        Math.min(Math.max(size, MIN_PANEL_HEIGHT), maxHeight),
      );
      return;
    }

    const maxWidth = Math.max(MIN_SIDE_WIDTH, bounds.width - MIN_VIEW_WIDTH);
    setLeftCollapsed(false);
    setLeftPanelWidth(Math.min(Math.max(size, MIN_SIDE_WIDTH), maxWidth));
  };

  const stopResize = useCallback(() => {
    const activeResize = activeResizeRef.current;
    if (!activeResize) return;

    // Pointer listeners live on document so dragging remains active outside the grip.
    document.removeEventListener("pointermove", activeResize.move);
    document.removeEventListener("pointerup", activeResize.stop);
    document.removeEventListener("pointercancel", activeResize.stop);
    document.body.classList.remove(
      "is-resizing",
      "is-column-resizing",
      "is-row-resizing",
    );
    activeResizeRef.current = undefined;
  }, []);

  const startResize = (
    target: PanelResizeTarget,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    event.preventDefault();

    // Only one drag may own the document listeners at a time.
    stopResize();

    if (event.currentTarget instanceof Element) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const axis: ResizeAxis = target === "bottom" ? "row" : "column";
    // Track the drag as a delta from the size at grab time: the panel then
    // follows the pointer no matter where the handle sits in the layout.
    const startX = event.clientX;
    const startY = event.clientY;
    const startSize = target === "bottom" ? panelHeight : leftWidth;
    const move = (moveEvent: PointerEvent) => {
      const delta =
        target === "bottom"
          ? startY - moveEvent.clientY
          : moveEvent.clientX - startX;
      setPanelSize(target, startSize + delta);
    };
    activeResizeRef.current = { move, stop: stopResize };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stopResize);
    document.addEventListener("pointercancel", stopResize);
    document.body.classList.add("is-resizing", `is-${axis}-resizing`);
  };

  const handleKeyDown = (
    target: PanelResizeTarget,
    event: ReactKeyboardEvent<HTMLElement>,
  ) => {
    const isBottom = target === "bottom";
    const bindings = isBottom
      ? DEFAULT_APP_KEYBINDINGS.resizePanel.vertical
      : DEFAULT_APP_KEYBINDINGS.resizePanel.horizontal;
    const increase = matchesKey(event.nativeEvent, bindings.increase);
    const decrease = matchesKey(event.nativeEvent, bindings.decrease);
    if (!increase && !decrease) return;

    event.preventDefault();

    const direction = increase ? 1 : -1;
    if (isBottom) {
      setPanelSize(target, panelHeight + direction * 16);
      return;
    }

    setPanelSize("left", leftWidth + direction * 16);
  };

  const toggleCollapsed = (target: PanelResizeTarget) => {
    if (target === "left") {
      setLeftCollapsed((collapsed) => !collapsed);
    } else {
      setPanelCollapsed((collapsed) => !collapsed);
    }
  };

  const setLayout = useCallback((element: HTMLDivElement | null) => {
    layoutRef.current = element;
  }, []);

  // Prevent a destroyed view from leaving global pointer listeners behind.
  useEffect(() => stopResize, [stopResize]);

  return {
    handleKeyDown,
    leftCollapsed,
    leftWidth,
    panelCollapsed,
    panelHeight,
    setLayout,
    startResize,
    toggleCollapsed,
  };
}

/** Panel state shared by the app shell and the sidebar controls. */
export type ResizablePanels = ReturnType<typeof useResizablePanels>;
