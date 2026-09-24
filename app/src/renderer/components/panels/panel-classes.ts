/** Shared chrome: panel headings, titles, icon buttons, navigation rows, and action buttons. */

/** Heading row shared by every panel title bar. */
export const PANEL_HEADING_CLASS =
  "flex min-h-[35px] items-center gap-2.5 px-3";

/** Navigation row shared by the primary sidebar and the manage screen. */
export const NAV_ROW_CLASS =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 px-2.5 py-1.5 " +
  "text-left text-body focus-visible:ring-1 focus-visible:ring-focusBorder";

/** Row state for the selected navigation entry. */
export const NAV_ROW_SELECTED_CLASS =
  "bg-list-activeSelectionBackground text-list-activeSelectionForeground";

/** Row state for navigation entries that can be opened. */
export const NAV_ROW_IDLE_CLASS =
  "text-descriptionForeground hover:bg-list-hoverBackground hover:text-foreground";

/** Sentence-case panel title, quiet enough to sit above the content. */
export const PANEL_TITLE_CLASS =
  "text-meta font-medium text-descriptionForeground";

/** Hover, focus, and shape shared by chrome icon buttons; add a size class. */
export const CHROME_BUTTON_CLASS =
  "grid shrink-0 cursor-pointer place-items-center rounded-md border-0 " +
  "bg-transparent text-terminal-ansiBrightBlack hover:bg-toolbar-hoverBackground hover:text-strongForeground " +
  "focus-visible:ring-1 focus-visible:ring-focusBorder";

/** 22px square icon button used by panel headings and view actions. */
export const ICON_BUTTON_CLASS = `size-5.5 ${CHROME_BUTTON_CLASS}`;

/** Small secondary button shared by the composer and dialog actions. */
export const SECONDARY_BUTTON_CLASS =
  "min-w-[52px] cursor-pointer rounded-md border border-button-secondaryBorder " +
  "bg-button-secondaryBackground px-2.5 py-1 text-meta text-button-secondaryForeground " +
  "hover:bg-button-secondaryHoverBackground";
