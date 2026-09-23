/** Menu button with a popover list: the app's single dropdown pattern. */

import { Combobox } from "@kobalte/core/combobox";
import { createSignal, Show } from "solid-js";

/** One selectable row in a dropdown. */
export type DropdownOption<T extends string = string> = {
  value: T;
  label: string;
  /** Optional second line, as used by projects and models. */
  description?: string;
  /** Right-aligned indicator, such as a provider's credential status. */
  trailing?: { label: string; tone: "success" | "muted" };
};

/** Inputs for the shared dropdown control. */
export type DropdownProps<T extends string = string> = {
  /** Accessible name for the control. */
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  /** Leading codicon, such as codicon-folder for the project. */
  icon?: string;
  /** Menu direction; controls at the bottom of the window open upwards. */
  placement?: "up" | "down";
  /** Which trigger edge the menu lines up with. */
  align?: "left" | "right";
  /** `field` renders a full-width bordered control for forms. */
  variant?: "plain" | "field";
  /** Shown on the trigger when no option matches the value. */
  placeholder?: string;
  disabled?: boolean;
  /** Adds a filter field above the list; the list narrows as the user types. */
  searchable?: boolean;
  /** Extra trigger classes, for example a width cap in a crowded row. */
  className?: string;
};

const TRIGGER_CLASS =
  "flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md border-0 " +
  "bg-transparent px-2 py-1 text-[12px] text-secondary hover:bg-surface-hover " +
  "focus-visible:ring-1 focus-visible:ring-focus disabled:cursor-default " +
  "disabled:opacity-55";

const FIELD_TRIGGER_CLASS =
  "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md " +
  "border border-border-strong bg-input px-2.5 py-1.5 text-[13px] " +
  "text-secondary hover:border-border-strong-hover focus-visible:border-focus " +
  "focus-visible:outline-none disabled:cursor-default disabled:opacity-55";

/** Chevron shown on every trigger. */
const CHEVRON_CLASS =
  "codicon codicon-chevron-down shrink-0 text-[12px] text-dim";

/** Search field at the top of the menu, full menu width. */
const MENU_SEARCH_CLASS =
  "mb-1 w-full shrink-0 rounded-md border border-border-strong bg-input " +
  "px-2 py-1 text-[12px] text-secondary outline-0 placeholder:text-faint " +
  "focus:border-focus";

/** One row of the menu. Kobalte marks the active row with `data-highlighted`. */
const ITEM_CLASS =
  "flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 px-2 py-1.5 " +
  "text-left data-[highlighted]:bg-surface-hover";

const MENU_CLASS =
  "z-30 flex max-h-72 w-max max-w-[min(340px,90vw)] min-w-full flex-col " +
  "overflow-hidden rounded-xl border border-border-strong bg-card p-1 shadow-card";

const LISTBOX_CLASS = "min-h-0 overflow-y-auto";

/** Trailing indicator styling and glyph, as used by the provider selector. */
const TRAILING_TONE = {
  success: { className: "text-success", glyph: "✓" },
  muted: { className: "text-dim", glyph: "•" },
};

/** Right-aligned credential indicator. */
function TrailingBadge(props: {
  trailing: NonNullable<DropdownOption["trailing"]>;
}) {
  const tone = () => TRAILING_TONE[props.trailing.tone];
  return (
    <span class={`shrink-0 text-[11px] ${tone().className}`}>
      {tone().glyph} {props.trailing.label}
    </span>
  );
}

/**
 * Render a trigger plus a keyboard-accessible popover list of options. The
 * trigger keeps showing the selection, and a searchable dropdown puts its
 * filter field inside the menu, so the control never stops reading as one.
 */
export function Dropdown<T extends string = string>(props: DropdownProps<T>) {
  const [open, setOpen] = createSignal(false);
  let trigger: HTMLButtonElement | undefined;
  let searchField: HTMLInputElement | undefined;

  const selected = () =>
    props.options.find((option) => option.value === props.value);
  const placement = () =>
    props.placement === "up"
      ? props.align === "right"
        ? ("top-end" as const)
        : ("top-start" as const)
      : props.align === "right"
        ? ("bottom-end" as const)
        : ("bottom-start" as const);
  // The trigger shows the label and takes its accessible name from that text.
  const triggerLabel = () =>
    selected()?.label ?? props.placeholder ?? props.label;

  const choose = (option: DropdownOption<T> | undefined) => {
    if (option && option.value !== props.value) props.onChange(option.value);
  };

  // Kobalte handles the keys of whichever element holds focus inside the menu,
  // and mounts that menu a frame after opening, so focus it on mount: the search
  // field when there is one, the first option otherwise. The field selects its
  // text so typing replaces the current value instead of appending to it.
  const focusWhenOpen = (
    resolve: () => HTMLElement | null | undefined,
    select = false,
  ) => {
    if (!open()) return;
    queueMicrotask(() => {
      if (!open()) return;
      const element = resolve();
      if (!element) return;
      element.focus();
      if (select && element instanceof HTMLInputElement) element.select();
    });
  };

  return (
    <Combobox<DropdownOption<T>>
      open={open()}
      onOpenChange={setOpen}
      options={props.options}
      optionValue={(option) => option.value}
      optionTextValue={(option) => option.label}
      // Without a label Kobalte falls back to String(option) for the input
      // value, which then filters every option away.
      optionLabel={(option) => option.label}
      // The filter field starts empty; Kobalte still reports the selected label as
      // its value before the user types, so treat that text as "no search yet"
      // and keep the whole list visible.
      defaultFilter={(option, input) => {
        const needle = input.trim().toLowerCase();
        if (needle === "" || input === selected()?.label) return true;
        return (
          option.label.toLowerCase().includes(needle) ||
          option.value.toLowerCase().includes(needle) ||
          (option.description ?? "").toLowerCase().includes(needle)
        );
      }}
      onChange={(option) => choose(option ?? undefined)}
      disabled={props.disabled}
      placement={placement()}
      gutter={4}
      sameWidth={props.variant === "field"}
      itemComponent={(itemProps) => (
        <Combobox.Item item={itemProps.item} class={ITEM_CLASS}>
          <span class="flex min-w-0 flex-1 flex-col">
            <Combobox.ItemLabel class="truncate text-[12px] text-secondary">
              {itemProps.item.rawValue.label}
            </Combobox.ItemLabel>
            <Show when={itemProps.item.rawValue.description}>
              <Combobox.ItemDescription class="truncate text-[11px] text-dim">
                {itemProps.item.rawValue.description}
              </Combobox.ItemDescription>
            </Show>
          </span>
          <Show when={itemProps.item.rawValue.trailing}>
            {(trailing) => <TrailingBadge trailing={trailing()} />}
          </Show>
          <Combobox.ItemIndicator class="shrink-0">
            <span
              class="codicon codicon-check text-[13px] text-secondary"
              decorative="true"
            />
          </Combobox.ItemIndicator>
        </Combobox.Item>
      )}
      class={`relative inline-block min-w-0 ${props.className ?? ""}`}
    >
      {/* Names the list and the filter field for Kobalte; the button above
          carries its own hidden label. */}
      <Combobox.Label class="sr-only">{props.label}</Combobox.Label>
      <Combobox.Control>
        <button
          ref={(element) => {
            trigger = element;
          }}
          type="button"
          class={
            props.variant === "field" ? FIELD_TRIGGER_CLASS : TRIGGER_CLASS
          }
          label={props.label}
          popup="listbox"
          expanded={String(open())}
          disabled={props.disabled}
          // Pointer down, like Kobalte's own trigger: a click would arrive
          // after the menu mounts and be read as a click outside it.
          onPointerDown={(event) => {
            if (!props.disabled && event.button === 0) setOpen(!open());
          }}
          onKeyDown={(event) => {
            if (
              ["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key) &&
              !props.disabled
            ) {
              event.preventDefault();
              setOpen(!open());
            }
          }}
        >
          {/* Names the control as well as its value: "Model gpt-5"
              reads better than a bare model name. */}
          <span class="sr-only">{props.label}</span>{" "}
          <Show when={props.icon}>
            <span
              class={`codicon ${props.icon} shrink-0 text-[13px] text-dim`}
              decorative="true"
            />
          </Show>
          <span class="max-w-[240px] min-w-0 truncate">{triggerLabel()}</span>
          <span class={CHEVRON_CLASS} decorative="true" />
        </button>
      </Combobox.Control>
      <Combobox.Portal>
        <Combobox.Content
          class={MENU_CLASS}
          // Closing hands focus back to the trigger, its only control.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger?.focus();
          }}
        >
          {/* The search field lives inside the menu so the trigger keeps its
              size and position while the menu is open. */}
          <Show when={props.searchable}>
            <Combobox.Input
              ref={(element) => {
                searchField = element;
                focusWhenOpen(() => searchField, true);
              }}
              class={MENU_SEARCH_CLASS}
              label={`Search ${props.label}`}
              placeholder={`Search ${props.label}`}
            />
          </Show>
          <Combobox.Listbox
            ref={(element) => {
              if (!props.searchable) focusWhenOpen(() => element);
            }}
            tabindex={-1}
            // Kobalte selects on Enter only through its own input, so a menu
            // without a filter field activates the highlighted row here.
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                return;
              }
              if (event.key !== "Enter" && event.key !== " ") return;
              const highlighted =
                event.currentTarget.querySelector<HTMLElement>(
                  "[data-highlighted]",
                );
              if (!highlighted) return;
              event.preventDefault();
              highlighted.click();
            }}
            class={LISTBOX_CLASS}
          />
        </Combobox.Content>
      </Combobox.Portal>
    </Combobox>
  );
}
