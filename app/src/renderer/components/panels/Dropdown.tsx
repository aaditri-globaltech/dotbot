/** Menu button with a popover list: the app's single dropdown pattern. */

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

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
  /** Replaces the trigger with a search field while the menu is open. */
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

/** Search field that takes the trigger's place, boxed like the field variant. */
const FIELD_SEARCH_CLASS =
  "w-full rounded-md border border-border-strong bg-input px-2.5 py-1.5 " +
  "text-[13px] text-secondary outline-0 placeholder:text-faint focus:border-focus";

/** Trailing indicator styling and glyph, as used by the provider selector. */
const TRAILING_TONE = {
  success: { className: "text-success", glyph: "✓" },
  muted: { className: "text-dim", glyph: "•" },
};

/** Render a trigger plus a keyboard-accessible popover list of options. */
export function Dropdown<T extends string = string>(props: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = props.options.find((option) => option.value === props.value);
  // The query stays empty unless the control is searchable, so it always filters.
  const needle = query.trim().toLowerCase();
  const options = needle
    ? props.options.filter(
        (option) =>
          option.label.toLowerCase().includes(needle) ||
          option.value.toLowerCase().includes(needle) ||
          (option.description ?? "").toLowerCase().includes(needle),
      )
    : props.options;

  useEffect(() => {
    if (!open) return;
    // A searchable control puts the caret where the trigger was.
    searchRef.current?.focus();
    // Any click outside the control closes the menu.
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const openMenu = () => {
    const index = props.options.findIndex(
      (option) => option.value === props.value,
    );
    setHighlight(index === -1 ? 0 : index);
    setQuery("");
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    setOpen(false);
    if (option && option.value !== props.value) props.onChange(option.value);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(highlight);
    } else if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div
      className={`relative inline-block min-w-0 ${props.className ?? ""}`}
      ref={containerRef}
    >
      {open && props.searchable ? (
        <input
          ref={searchRef}
          className={FIELD_SEARCH_CLASS}
          placeholder={props.placeholder ?? props.label}
          dotbot-label={`Search ${props.label}`}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
          }}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <button
          className={
            props.variant === "field" ? FIELD_TRIGGER_CLASS : TRIGGER_CLASS
          }
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          dotbot-label={props.label}
          disabled={props.disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={handleKeyDown}
        >
          {props.icon && (
            <span
              className={`codicon ${props.icon} shrink-0 text-[13px] text-dim`}
              dotbot-hidden="true"
            />
          )}
          <span className="max-w-[240px] min-w-0 truncate">
            {selected?.label ?? props.placeholder ?? props.label}
          </span>
          <span
            className="codicon codicon-chevron-down shrink-0 text-[12px] text-dim"
            dotbot-hidden="true"
          />
        </button>
      )}

      {open && (
        <div
          // The menu sizes to its own content, not to the trigger's width.
          className={`absolute z-30 flex max-h-72 w-max max-w-[min(340px,90vw)] min-w-full flex-col overflow-hidden rounded-xl border border-border-strong bg-card p-1 shadow-card ${
            props.placement === "up" ? "bottom-full mb-1" : "top-full mt-1"
          } ${props.align === "right" ? "right-0" : "left-0"}`}
          dotbot-label={`${props.label} options`}
        >
          <div className="min-h-0 overflow-y-auto" role="listbox">
            {options.length === 0 && (
              <p className="px-2 py-1.5 text-[12px] text-dim">
                {needle ? "No matches" : "No options"}
              </p>
            )}
            {options.map((option, index) => (
              <button
                key={option.value}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 px-2 py-1.5 text-left ${
                  index === highlight ? "bg-surface-hover" : ""
                }`}
                type="button"
                role="option"
                aria-selected={option.value === props.value}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(index)}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[12px] text-secondary">
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="truncate text-[11px] text-dim">
                      {option.description}
                    </span>
                  )}
                </span>
                {option.trailing && (
                  <span
                    className={`shrink-0 text-[11px] ${TRAILING_TONE[option.trailing.tone].className}`}
                  >
                    {TRAILING_TONE[option.trailing.tone].glyph}{" "}
                    {option.trailing.label}
                  </span>
                )}
                {option.value === props.value && (
                  <span
                    className="codicon codicon-check shrink-0 text-[13px] text-secondary"
                    dotbot-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
