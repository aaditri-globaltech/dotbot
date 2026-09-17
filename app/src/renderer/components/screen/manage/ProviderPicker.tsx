import type { AgentProviderSummary } from "@dotbot/agent-core";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type ProviderPickerProps = {
  providers: AgentProviderSummary[];
  selected?: AgentProviderSummary;
  onSelect: (providerId: string) => void;
};

function ProviderStatus(props: { configured: boolean }) {
  return (
    <span
      className={`text-xs ${props.configured ? "text-success" : "text-muted"}`}
    >
      {props.configured ? "✓ Configured" : "Not configured"}
    </span>
  );
}

/** Searchable provider selector overlay, mirroring the agent's own selector. */
export function ProviderPicker(props: ProviderPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const needle = query.trim().toLowerCase();
  const matches = props.providers.filter(
    (provider) =>
      !needle ||
      provider.name.toLowerCase().includes(needle) ||
      provider.id.toLowerCase().includes(needle),
  );
  const lastIndex = Math.max(matches.length - 1, 0);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && !containerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const openPicker = () => {
    setQuery("");
    setHighlight(0);
    setOpen(true);
  };

  const choose = (index: number) => {
    const provider = matches[index];
    if (provider) props.onSelect(provider.id);
    setOpen(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, lastIndex));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(highlight);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative min-w-0 flex-1" ref={containerRef}>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-3 border border-border-strong bg-input px-2.5 py-1.5 text-left text-secondary hover:border-focus focus-visible:border-focus focus:outline-none"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        {props.selected ? (
          <>
            <span>{props.selected.name}</span>
            <ProviderStatus configured={props.selected.configured} />
          </>
        ) : (
          <span className="text-muted">Select a provider</span>
        )}
        <span className="codicon codicon-chevron-down" dotbot-hidden="true" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+4px)] z-20 flex max-h-80 flex-col border border-border-strong bg-input shadow-[0_8px_20px_rgb(0_0_0/45%)]">
          <input
            ref={inputRef}
            className="border-b border-border bg-app px-2.5 py-1.5 text-secondary focus:outline-none"
            placeholder="Search providers"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="min-h-0 overflow-auto">
            {matches.map((provider, index) => (
              <button
                key={provider.id}
                type="button"
                className={`flex w-full cursor-pointer items-center justify-between gap-3 px-2.5 py-1.5 text-left text-secondary hover:bg-surface-hover focus-visible:bg-surface-hover ${
                  index === highlight ? "bg-surface-hover" : ""
                }`}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(index)}
              >
                <span>{provider.name}</span>
                <ProviderStatus configured={provider.configured} />
              </button>
            ))}
            {matches.length === 0 && (
              <p className="m-2.5 text-xs text-dim">No matching providers</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
