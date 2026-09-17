/** Shared workbench chrome: panel headings, titles, and icon buttons. */

/** Heading row shared by every panel title bar. */
export const PANEL_HEADING_CLASS =
  "flex min-h-[35px] items-center gap-2.5 px-3";

/** Uppercase panel title. */
export const PANEL_TITLE_CLASS =
  "text-[11px] font-medium tracking-[0.04em] text-secondary uppercase";

/** 22px square icon button used by panel headings and view actions. */
export const ICON_BUTTON_CLASS =
  "grid size-5.5 shrink-0 cursor-pointer place-items-center border-0 " +
  "bg-transparent text-dim hover:text-primary focus-visible:ring-1 " +
  "focus-visible:ring-focus";
