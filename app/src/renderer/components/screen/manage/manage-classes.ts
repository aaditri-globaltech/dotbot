/** Shared form and button presentation for the manage screen. */

/** Label plus an input, stacked. */
export const FIELD_CLASS = "flex flex-col gap-1 text-body";

/** Text, password, select, and search controls. */
export const INPUT_CLASS =
  "w-full rounded-md border border-input-border bg-input-background px-2 py-1.5 " +
  "text-foreground focus:border-focusBorder focus:outline-none";

/** Secondary buttons, including the provider picker row actions. */
export const BUTTON_CLASS =
  "cursor-pointer rounded-md border border-button-secondaryBorder bg-button-secondaryBackground px-3 py-1.5 " +
  "text-button-secondaryForeground hover:bg-button-secondaryHoverBackground disabled:cursor-default disabled:opacity-50";

/** Card wrapper for one setting: label, description, and its control. */
export const CARD_CLASS =
  "rounded-xl border border-widget-border bg-editorWidget-background px-4 py-4";

/** Setting label inside a card. */
export const CARD_TITLE_CLASS = "text-body font-medium text-foreground";

/** Muted explanation under a setting label. */
export const CARD_HINT_CLASS =
  "mt-0.5 text-meta leading-normal text-terminal-ansiBrightBlack";
