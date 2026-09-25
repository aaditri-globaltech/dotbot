/** Keep panel dimensions, collapse state, and pointer lifecycle in one hook. */

import { createSignal, onCleanup } from "solid-js";
import { DEFAULT_APP_KEYBINDINGS, matchesKey } from "../keybindings";
import {
  COLLAPSED_PANEL_HEIGHT,
  COLLAPSED_SIDE_WIDTH,
  clampPanelSize,
  type PanelResizeTarget,
} from "./panel-size";

type ResizeAxis = "column" | "row";

type ActiveResize = {
  move: (event: PointerEvent) => void;
  stop: () => void;
};

/** Track panel sizes and provide pointer/keyboard resize handlers. */
export function createResizablePanels() {
  const [leftPanelWidth, setLeftPanelWidth] = createSignal(240);
  const [expandedPanelHeight, setExpandedPanelHeight] = createSignal(200);
  const [leftCollapsed, setLeftCollapsed] = createSignal(false);
  const [panelCollapsed, setPanelCollapsed] = createSignal(true);
  let layoutElement: HTMLElement | undefined;
  let activeResize: ActiveResize | undefined;

  const leftWidth = () =>
    leftCollapsed() ? COLLAPSED_SIDE_WIDTH : leftPanelWidth();
  const panelHeight = () =>
    panelCollapsed() ? COLLAPSED_PANEL_HEIGHT : expandedPanelHeight();

  const setPanelSize = (target: PanelResizeTarget, size: number) => {
    const layout = layoutElement;
    if (!layout) return;

    // Clamp each panel against the minimum space reserved for the view.
    const bounds = layout.getBoundingClientRect();

    if (target === "bottom") {
      setPanelCollapsed(false);
      setExpandedPanelHeight(clampPanelSize(target, size, bounds));
      return;
    }

    setLeftCollapsed(false);
    setLeftPanelWidth(clampPanelSize(target, size, bounds));
  };

  const stopResize = () => {
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
    activeResize = undefined;
  };

  const startResize = (target: PanelResizeTarget, event: PointerEvent) => {
    event.preventDefault();

    // Only one drag may own the document listeners at a time.
    stopResize();

    const grip = event.currentTarget;
    if (grip instanceof Element) grip.setPointerCapture(event.pointerId);

    const axis: ResizeAxis = target === "bottom" ? "row" : "column";
    // Track the drag as a delta from the size at grab time: the panel then
    // follows the pointer no matter where the handle sits in the layout.
    const startX = event.clientX;
    const startY = event.clientY;
    const startSize = target === "bottom" ? panelHeight() : leftWidth();
    const move = (moveEvent: PointerEvent) => {
      const delta =
        target === "bottom"
          ? startY - moveEvent.clientY
          : moveEvent.clientX - startX;
      setPanelSize(target, startSize + delta);
    };
    activeResize = { move, stop: stopResize };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stopResize);
    document.addEventListener("pointercancel", stopResize);
    document.body.classList.add("is-resizing", `is-${axis}-resizing`);
  };

  const handleKeyDown = (target: PanelResizeTarget, event: KeyboardEvent) => {
    const isBottom = target === "bottom";
    const bindings = isBottom
      ? DEFAULT_APP_KEYBINDINGS.resizePanel.vertical
      : DEFAULT_APP_KEYBINDINGS.resizePanel.horizontal;
    const increase = matchesKey(event, bindings.increase);
    const decrease = matchesKey(event, bindings.decrease);
    if (!increase && !decrease) return;

    event.preventDefault();

    const direction = increase ? 1 : -1;
    if (isBottom) {
      setPanelSize(target, panelHeight() + direction * 16);
      return;
    }

    setPanelSize("left", leftWidth() + direction * 16);
  };

  const toggleCollapsed = (target: PanelResizeTarget) => {
    if (target === "left") {
      setLeftCollapsed((collapsed) => !collapsed);
    } else {
      setPanelCollapsed((collapsed) => !collapsed);
    }
  };

  // Prevent a destroyed view from leaving global pointer listeners behind.
  onCleanup(stopResize);

  return {
    handleKeyDown,
    leftCollapsed,
    leftWidth,
    panelCollapsed,
    panelHeight,
    setLayout: (element: HTMLElement | undefined) => {
      layoutElement = element;
    },
    startResize,
    toggleCollapsed,
  };
}

/** Panel state shared by the app shell and the sidebar controls. */
export type ResizablePanels = ReturnType<typeof createResizablePanels>;
