import type { KeyboardEvent, PointerEvent } from "react";
import {
  COLLAPSED_PANEL_HEIGHT,
  COLLAPSED_SIDE_WIDTH,
  type PanelResizeTarget,
} from "../../hooks/useResizablePanels";

/** Accessible resize-handle inputs for one workbench boundary. */
type PanelResizerProps = {
  controls: string;
  label: string;
  onKeyDown: (event: KeyboardEvent<HTMLHRElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLHRElement>) => void;
  target: PanelResizeTarget;
  value: number;
};

/** Render a drag- and keyboard-accessible panel boundary. */
export function PanelResizer(props: PanelResizerProps) {
  const isBottom = props.target === "bottom";

  return (
    // Range metadata makes the visual separator usable as a keyboard control.
    <hr
      className={`panel-border ${props.target}-panel-border`}
      aria-label={props.label}
      aria-controls={props.controls}
      aria-orientation={isBottom ? "horizontal" : "vertical"}
      aria-valuemin={isBottom ? COLLAPSED_PANEL_HEIGHT : COLLAPSED_SIDE_WIDTH}
      aria-valuenow={Math.round(props.value)}
      tabIndex={0}
      onPointerDown={props.onPointerDown}
      onKeyDown={props.onKeyDown}
    />
  );
}
