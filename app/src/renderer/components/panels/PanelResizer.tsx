import {
  COLLAPSED_PANEL_HEIGHT,
  COLLAPSED_SIDE_WIDTH,
  type PanelResizeTarget,
} from "../../hooks/panel-size";

/** Accessible resize-handle inputs for one workbench boundary. */
type PanelResizerProps = {
  controls: string;
  label: string;
  onKeyDown: (event: KeyboardEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  target: PanelResizeTarget;
  value: number;
};

/** Render a drag- and keyboard-accessible panel boundary. */
export function PanelResizer(props: PanelResizerProps) {
  const isBottom = () => props.target === "bottom";

  return (
    // Range metadata makes the visual separator usable as a keyboard control.
    <hr
      class={`panel-border ${props.target}-panel-border`}
      label={props.label}
      resizes={props.controls}
      orientation={isBottom() ? "horizontal" : "vertical"}
      min-size={isBottom() ? COLLAPSED_PANEL_HEIGHT : COLLAPSED_SIDE_WIDTH}
      current-size={Math.round(props.value)}
      tabindex={0}
      onPointerDown={props.onPointerDown}
      onKeyDown={props.onKeyDown}
    />
  );
}
