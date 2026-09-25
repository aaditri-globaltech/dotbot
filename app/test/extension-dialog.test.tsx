// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExtensionDialog } from "../src/renderer/components/panels/ExtensionDialog";

// @solidjs/testing-library only registers automatic cleanup when Vitest runs with
// `globals: true`, which this repository does not use.
afterEach(cleanup);

function confirmRequest() {
  return {
    id: "req-1",
    method: "confirm" as const,
    title: "Allow command?",
    message: "The agent wants to run a command.",
  };
}

describe("ExtensionDialog", () => {
  it("reports a confirmed answer", () => {
    const onRespond = vi.fn();
    render(() => (
      <ExtensionDialog request={confirmRequest()} onRespond={onRespond} />
    ));

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onRespond).toHaveBeenCalledWith({
      type: "extension_ui_response",
      id: "req-1",
      confirmed: true,
    });
  });

  it("reports a cancellation on Escape", () => {
    const onRespond = vi.fn();
    render(() => (
      <ExtensionDialog request={confirmRequest()} onRespond={onRespond} />
    ));

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(onRespond).toHaveBeenCalledWith({
      type: "extension_ui_response",
      id: "req-1",
      cancelled: true,
    });
  });

  it("keeps focus inside the dialog", async () => {
    render(() => (
      <ExtensionDialog request={confirmRequest()} onRespond={() => undefined} />
    ));

    const dialog = screen.getByRole("dialog");
    // The dialog moves focus into its own card after mount.
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );
  });

  it("returns focus to the element that opened it", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const result = render(() => (
      <ExtensionDialog request={confirmRequest()} onRespond={() => undefined} />
    ));
    result.unmount();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("does not cancel when the overlay is clicked", () => {
    const onRespond = vi.fn();
    render(() => (
      <ExtensionDialog request={confirmRequest()} onRespond={onRespond} />
    ));

    const dialog = screen.getByRole("dialog");
    fireEvent.pointerDown(dialog.parentElement ?? dialog);
    expect(onRespond).not.toHaveBeenCalled();
  });
});
