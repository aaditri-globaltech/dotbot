/** Shared form and button presentation for the manage screen. */

/** Label plus an input, stacked. */
export const FIELD_CLASS = "flex flex-col gap-1 text-[13px]";

/** Text, password, select, and search controls. */
export const INPUT_CLASS =
  "w-full rounded-md border border-border-strong bg-input px-2 py-1.5 " +
  "text-secondary focus:border-focus focus:outline-none";

/** Secondary buttons, including the provider picker row actions. */
export const BUTTON_CLASS =
  "cursor-pointer rounded-md border border-border-strong bg-surface-hover px-3 py-1.5 " +
  "text-secondary hover:bg-elevated disabled:cursor-default disabled:opacity-50";

/** Card wrapper for one setting: label, description, and its control. */
export const CARD_CLASS = "rounded-xl border border-border bg-card px-4 py-3.5";

/** Setting label inside a card. */
export const CARD_TITLE_CLASS = "text-[13px] font-medium text-secondary";

/** Muted explanation under a setting label. */
export const CARD_HINT_CLASS = "mt-0.5 text-[11px] leading-normal text-dim";
