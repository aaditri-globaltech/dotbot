/** Trust choices rendered inside the composer's dialogue card. */

import type { ExtensionResponse, TrustRequest } from "@dotbot/agent-core";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

export type TrustPromptProps = {
  request: Extract<TrustRequest, { method: "select" }>;
  onRespond: (response: ExtensionResponse) => void;
};

/** Split the multi-line trust prompt into a heading and an explanation. */
function splitPrompt(title: string): { heading: string; detail?: string } {
  const [heading = "", ...rest] = title.split("\n");
  const detail = rest.join("\n").trim();
  return detail ? { heading, detail } : { heading };
}

/** Keyboard-navigable trust choices rendered in the composer's dialogue card. */
export function TrustPrompt(props: TrustPromptProps) {
  const options = props.request.options;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const { heading, detail } = splitPrompt(props.request.title);

  useEffect(() => {
    container.current?.focus();
  }, []);

  const respond = (value: string) =>
    props.onRespond({
      type: "extension_ui_response",
      id: props.request.id,
      value,
    });

  const cancel = () =>
    props.onRespond({
      type: "extension_ui_response",
      id: props.request.id,
      cancelled: true,
    });

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp" || event.key === "k") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "ArrowDown" || event.key === "j") {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(options.length - 1, index + 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      respond(options[selectedIndex]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  return (
    <div
      ref={container}
      className="outline-none"
      tabIndex={-1}
      role="listbox"
      aria-label={heading}
      onKeyDown={handleKeyDown}
    >
      <div className="pb-2">
        <div className="text-sm font-medium text-secondary">{heading}</div>
        {detail && (
          <div className="mt-1 text-[12px] leading-normal text-dim [white-space:pre-wrap]">
            {detail}
          </div>
        )}
      </div>
      <div className="-mx-3 flex flex-col gap-0.5">
        {options.map((option, index) => (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-xl border-0 px-3 py-2 text-left text-sm ${
              index === selectedIndex
                ? "bg-card text-primary"
                : "bg-transparent text-secondary hover:bg-surface-hover"
            }`}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => respond(option)}
          >
            <span
              className={`codicon codicon-arrow-right w-4 shrink-0 text-[12px] text-accent ${
                index === selectedIndex ? "opacity-100" : "opacity-0"
              }`}
              dotbot-hidden="true"
            />
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              {option}
            </span>
          </button>
        ))}
      </div>
      <div className="pt-2.5 text-[11px] text-faint">
        ↑↓ navigate · Enter select · Esc cancel
      </div>
    </div>
  );
}
