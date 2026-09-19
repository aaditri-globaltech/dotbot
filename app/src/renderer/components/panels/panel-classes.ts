/** Shared chrome: panel headings, titles, icon buttons, and navigation rows. */

/** Heading row shared by every panel title bar. */
export const PANEL_HEADING_CLASS =
  "flex min-h-[35px] items-center gap-2.5 px-3";

/** Navigation row shared by the primary sidebar and the manage screen. */
export const NAV_ROW_CLASS =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 px-2.5 py-1.5 " +
  "text-left text-[13px] focus-visible:ring-1 focus-visible:ring-focus";

/** Row state for the selected navigation entry. */
export const NAV_ROW_SELECTED_CLASS = "bg-card text-primary";

/** Row state for navigation entries that can be opened. */
export const NAV_ROW_IDLE_CLASS =
  "text-muted hover:bg-surface-hover hover:text-secondary";

/** Sentence-case panel title, quiet enough to sit above the content. */
export const PANEL_TITLE_CLASS = "text-[11px] font-medium text-muted";

/** 22px square icon button used by panel headings and view actions. */
export const ICON_BUTTON_CLASS =
  "grid size-5.5 shrink-0 cursor-pointer place-items-center rounded-md border-0 " +
  "bg-transparent text-dim hover:bg-control hover:text-primary focus-visible:ring-1 " +
  "focus-visible:ring-focus";
