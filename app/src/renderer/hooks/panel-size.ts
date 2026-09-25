/** Panel clamping, kept free of the DOM so the arithmetic stays testable. */

// These values preserve a usable view while allowing panels to collapse fully.
/** Minimum expanded width for the sidebar in pixels. */
export const MIN_SIDE_WIDTH = 170;
/** Minimum expanded height for the bottom panel in pixels. */
export const MIN_PANEL_HEIGHT = 77;
/** Collapsed side-panel width in pixels; wide enough for an icon rail. */
export const COLLAPSED_SIDE_WIDTH = 52;
/** Collapsed bottom-panel height in pixels. */
export const COLLAPSED_PANEL_HEIGHT = 0;

const MIN_VIEW_WIDTH = 320;
const MIN_TOP_HEIGHT = 240;

/** Workbench boundary controlled by the resize hook. */
export type PanelResizeTarget = "left" | "bottom";

/** Bounds of the element that holds both panels. */
export type PanelBounds = { width: number; height: number };

/** Clamp one panel against its own minimum and the space the view needs. */
export function clampPanelSize(
  target: PanelResizeTarget,
  size: number,
  bounds: PanelBounds,
): number {
  const minimum = target === "bottom" ? MIN_PANEL_HEIGHT : MIN_SIDE_WIDTH;
  const available =
    target === "bottom"
      ? bounds.height - MIN_TOP_HEIGHT
      : bounds.width - MIN_VIEW_WIDTH;
  // The panel never grows past the space the view keeps for itself.
  return Math.min(Math.max(size, minimum), Math.max(minimum, available));
}
