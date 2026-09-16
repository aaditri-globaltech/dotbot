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
      dotbot-label={props.label}
      dotbot-controls={props.controls}
      dotbot-orientation={isBottom ? "horizontal" : "vertical"}
      dotbot-valuemin={isBottom ? COLLAPSED_PANEL_HEIGHT : COLLAPSED_SIDE_WIDTH}
      dotbot-valuenow={Math.round(props.value)}
      tabIndex={0}
      onPointerDown={props.onPointerDown}
      onKeyDown={props.onKeyDown}
    />
  );
}
