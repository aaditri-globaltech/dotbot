/** Menu button with a popover list: the app's single dropdown pattern. */

import {
  createEffect,
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

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
  "bg-transparent px-2 py-1 text-body text-foreground hover:bg-list-hoverBackground " +
  "focus-visible:ring-1 focus-visible:ring-focusBorder disabled:cursor-default " +
  "disabled:opacity-55";

const FIELD_TRIGGER_CLASS =
  "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md " +
  "border border-input-border bg-input-background px-2.5 py-1.5 text-body " +
  "text-foreground hover:border-menu-border focus-visible:border-focusBorder " +
  "focus-visible:outline-none disabled:cursor-default disabled:opacity-55";

/** Chevron shown on every trigger. */
const CHEVRON_CLASS =
  "codicon codicon-chevron-down shrink-0 text-[12px] text-terminal-ansiBrightBlack";

/** Search field at the top of the menu, full menu width. */
const MENU_SEARCH_CLASS =
  "mb-1 w-full shrink-0 rounded-md border border-input-border bg-input-background " +
  "px-2 py-1 text-body text-foreground outline-0 placeholder:text-disabledForeground " +
  "focus:border-focusBorder";

/** One row of the menu. The active row carries `data-highlighted`. */
const ITEM_CLASS =
  "flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 px-2 py-1.5 " +
  "text-left data-[highlighted]:bg-list-hoverBackground";

/** Fixed so no panel's scroll or overflow can clip the menu. */
const MENU_CLASS =
  "fixed z-30 flex max-h-72 w-max max-w-[min(340px,90vw)] flex-col " +
  "overflow-hidden rounded-xl border border-menu-border bg-menu-background p-1 shadow-card";

const LISTBOX_CLASS = "min-h-0 overflow-y-auto";

/** Gap between the trigger and its menu, in pixels. */
const MENU_GUTTER = 4;

/** Trailing indicator styling and glyph, as used by the provider selector. */
const TRAILING_TONE = {
  success: {
    className: "text-gitDecoration-untrackedResourceForeground",
    glyph: "✓",
  },
  muted: { className: "text-terminal-ansiBrightBlack", glyph: "•" },
};

/** Right-aligned credential indicator. */
function TrailingBadge(props: {
  trailing: NonNullable<DropdownOption["trailing"]>;
}) {
  const tone = () => TRAILING_TONE[props.trailing.tone];
  return (
    <span class={`shrink-0 text-meta ${tone().className}`}>
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
  const [query, setQuery] = createSignal("");
  const [highlighted, setHighlighted] = createSignal(0);
  const [position, setPosition] = createSignal<JSX.CSSProperties>({});
  let root: HTMLDivElement | undefined;
  let trigger: HTMLButtonElement | undefined;
  let menu: HTMLElement | undefined;
  let searchField: HTMLInputElement | undefined;

  // The trigger shows the label and takes its accessible name from that text.
  const triggerLabel = () =>
    props.options.find((option) => option.value === props.value)?.label ??
    props.placeholder ??
    props.label;
  /** Options the filter keeps: label, value, and description all match. */
  const matches = () => {
    const needle = query().trim().toLowerCase();
    if (needle === "") return props.options;
    return props.options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.value.toLowerCase().includes(needle) ||
        (option.description ?? "").toLowerCase().includes(needle),
    );
  };

  /** Line the menu up with the trigger, which the fixed menu does not follow. */
  const place = () => {
    const element = trigger;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    // A plain menu may grow past its trigger; a field menu matches it, capped
    // by the menu's own max width.
    const style: JSX.CSSProperties =
      props.variant === "field"
        ? { width: `${rect.width}px` }
        : { "min-width": `${rect.width}px` };
    if (props.placement === "up") {
      style.bottom = `${window.innerHeight - rect.top + MENU_GUTTER}px`;
    } else {
      style.top = `${rect.bottom + MENU_GUTTER}px`;
    }
    if (props.align === "right") {
      style.right = `${window.innerWidth - rect.right}px`;
    } else {
      style.left = `${rect.left}px`;
    }
    setPosition(style);
  };

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setQuery("");
    if (returnFocus) trigger?.focus();
  };

  const choose = (option: DropdownOption<T> | undefined) => {
    if (option && option.value !== props.value) props.onChange(option.value);
    close(true);
  };

  const openMenu = () => {
    if (props.disabled) return;
    place();
    setQuery("");
    setHighlighted(
      Math.max(
        0,
        props.options.findIndex((option) => option.value === props.value),
      ),
    );
    setOpen(true);
    // Solid mounts the menu synchronously, so its ref is set by the time the
    // focus lands: the search field when there is one, the list otherwise.
    if (props.searchable) {
      searchField?.focus();
      searchField?.select();
    } else {
      menu?.focus();
    }
  };

  const moveHighlight = (step: number) => {
    const count = matches().length;
    if (count === 0) return;
    setHighlighted((current) =>
      Math.min(count - 1, Math.max(0, current + step)),
    );
  };

  /** Keys of both focus holders inside the menu: the list and the filter. */
  const menuKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setHighlighted(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setHighlighted(Math.max(0, matches().length - 1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      // A space is text in the filter field; only the list activates on it.
      if (event.key === " " && event.target instanceof HTMLInputElement) {
        return;
      }
      event.preventDefault();
      choose(matches()[highlighted()]);
      return;
    }
    // Tab leaves the control; the browser keeps the focus it moves.
    if (event.key === "Tab") close(false);
  };

  onMount(() => {
    // Presses outside the control dismiss it; the trigger toggles below.
    const onPointerDown = (event: PointerEvent) => {
      if (!open()) return;
      const target = event.target;
      if (target instanceof Node && root?.contains(target)) return;
      close(false);
    };
    const reposition = () => {
      if (open()) place();
    };
    document.addEventListener("pointerdown", onPointerDown);
    // Capture, because a panel scrolls without the window scrolling.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    onCleanup(() => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    });
  });

  // Keep the highlighted row in view as the keyboard moves it.
  createEffect(() => {
    if (!open()) return;
    const row = highlighted();
    menu
      ?.querySelectorAll<HTMLElement>('[role="option"]')
      [row]?.scrollIntoView({ block: "nearest" });
  });

  return (
    <div
      ref={(element) => {
        root = element;
      }}
      class={`relative inline-block min-w-0 ${props.className ?? ""}`}
    >
      <button
        ref={(element) => {
          trigger = element;
        }}
        type="button"
        class={props.variant === "field" ? FIELD_TRIGGER_CLASS : TRIGGER_CLASS}
        label={props.label}
        popup="listbox"
        expanded={String(open())}
        aria-haspopup="listbox"
        aria-expanded={open()}
        disabled={props.disabled}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if (open()) close(true);
          else openMenu();
        }}
        onKeyDown={(event) => {
          if (!["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
            return;
          }
          event.preventDefault();
          openMenu();
        }}
      >
        {/* Names the control as well as its value: "Model gpt-5"
            reads better than a bare model name. */}
        <span class="sr-only">{props.label}</span>{" "}
        <Show when={props.icon}>
          <span
            class={`codicon ${props.icon} shrink-0 text-[13px] text-terminal-ansiBrightBlack`}
            decorative="true"
          />
        </Show>
        <span class="max-w-[240px] min-w-0 truncate">{triggerLabel()}</span>
        <span class={CHEVRON_CLASS} decorative="true" />
      </button>

      <Show when={open()}>
        <div class={MENU_CLASS} style={position()}>
          {/* The search field lives inside the menu so the trigger keeps its
              size and position while the menu is open. */}
          <Show when={props.searchable}>
            <input
              ref={(element) => {
                searchField = element;
              }}
              class={MENU_SEARCH_CLASS}
              label={`Search ${props.label}`}
              aria-label={`Search ${props.label}`}
              placeholder={`Search ${props.label}`}
              value={query()}
              onInput={(event) => {
                setQuery(event.currentTarget.value);
                setHighlighted(0);
              }}
              onKeyDown={menuKeyDown}
            />
          </Show>
          <div
            ref={(element) => {
              menu = element;
            }}
            role="listbox"
            tabindex={-1}
            label={props.label}
            aria-label={props.label}
            class={LISTBOX_CLASS}
            onKeyDown={menuKeyDown}
          >
            <For each={matches()}>
              {(option, index) => (
                <button
                  type="button"
                  role="option"
                  tabindex={-1}
                  // The description stays visible text, not part of the name.
                  aria-label={option.label}
                  aria-selected={option.value === props.value}
                  data-highlighted={index() === highlighted() ? "" : undefined}
                  class={ITEM_CLASS}
                  onPointerEnter={() => setHighlighted(index())}
                  onClick={() => choose(option)}
                >
                  <span class="flex min-w-0 flex-1 flex-col">
                    <span class="truncate text-body text-foreground">
                      {option.label}
                    </span>
                    <Show when={option.description}>
                      <span class="truncate text-meta text-terminal-ansiBrightBlack">
                        {option.description}
                      </span>
                    </Show>
                  </span>
                  <Show when={option.trailing}>
                    {(trailing) => <TrailingBadge trailing={trailing()} />}
                  </Show>
                  <Show when={option.value === props.value}>
                    <span
                      class="codicon codicon-check shrink-0 text-[13px] text-foreground"
                      decorative="true"
                    />
                  </Show>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
