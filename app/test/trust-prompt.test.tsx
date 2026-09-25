// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrustPrompt } from "../src/renderer/components/panels/TrustPrompt";

// @solidjs/testing-library only registers automatic cleanup when Vitest runs with
// `globals: true`, which this repository does not use.
afterEach(cleanup);

const request = {
  id: "trust-1",
  method: "select" as const,
  title: "Trust this project?\nIt can run commands.",
  options: ["Trust once", "Trust always", "Do not trust"],
};

describe("TrustPrompt", () => {
  it("answers with the option moved to by the keyboard", () => {
    const onRespond = vi.fn();
    render(() => <TrustPrompt request={request} onRespond={onRespond} />);

    fireEvent.keyDown(screen.getByRole("listbox"), { key: "j" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Enter" });

    expect(onRespond).toHaveBeenCalledWith({
      type: "extension_ui_response",
      id: "trust-1",
      value: "Trust always",
    });
  });

  it("cancels on Escape", () => {
    const onRespond = vi.fn();
    render(() => <TrustPrompt request={request} onRespond={onRespond} />);

    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });

    expect(onRespond).toHaveBeenCalledWith({
      type: "extension_ui_response",
      id: "trust-1",
      cancelled: true,
    });
  });

  it("moves focus into the card and marks the selected row", () => {
    render(() => <TrustPrompt request={request} onRespond={() => undefined} />);

    const listbox = screen.getByRole("listbox");
    expect(document.activeElement).toBe(listbox);
    expect(listbox.getAttribute("label")).toBe("Trust this project?");
    expect(
      screen
        .getByRole("option", { name: "Trust once" })
        .getAttribute("is-selected"),
    ).toBe("true");
  });
});
