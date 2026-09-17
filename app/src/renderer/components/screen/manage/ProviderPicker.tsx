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
      className={`manage-provider-status ${props.configured ? "is-configured" : ""}`}
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
    <div className="provider-picker" ref={containerRef}>
      <button
        type="button"
        className="provider-picker-trigger"
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
          <span className="screen-empty">Select a provider</span>
        )}
        <span className="codicon codicon-chevron-down" dotbot-hidden="true" />
      </button>
      {open && (
        <div className="provider-picker-overlay">
          <input
            ref={inputRef}
            className="provider-picker-search"
            placeholder="Search providers"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="provider-picker-list">
            {matches.map((provider, index) => (
              <button
                key={provider.id}
                type="button"
                className={`manage-provider-item ${index === highlight ? "is-highlighted" : ""}`}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(index)}
              >
                <span>{provider.name}</span>
                <ProviderStatus configured={provider.configured} />
              </button>
            ))}
            {matches.length === 0 && (
              <p className="provider-picker-empty">No matching providers</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
