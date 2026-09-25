import { PANEL_HEADING_CLASS, PANEL_TITLE_CLASS } from "./panel-classes";

/** Title displayed at the top of a workbench panel. */
type PanelHeaderProps = {
  title: string;
};

/** Render a panel heading. */
export function PanelHeader(props: PanelHeaderProps) {
  return (
    <div class={PANEL_HEADING_CLASS}>
      <h1 class={PANEL_TITLE_CLASS}>{props.title}</h1>
    </div>
  );
}
