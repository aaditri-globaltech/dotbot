// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelResizer } from "../src/renderer/components/panels/PanelResizer";

// @solidjs/testing-library only registers automatic cleanup when Vitest runs with
// `globals: true`, which this repository does not use.
afterEach(cleanup);

describe("PanelResizer", () => {
  it("reports keyboard resize as a focusable control", () => {
    const onKeyDown = vi.fn();
    render(() => (
      <PanelResizer
        target="left"
        value={240}
        label="Resize side bar and view border"
        controls="primary-sidebar view"
        onPointerDown={() => undefined}
        onKeyDown={onKeyDown}
      />
    ));

    // The handle carries plain attributes rather than aria labels, so query by
    // its implicit role instead of an accessible name.
    const handle = screen.getByRole("separator");
    expect(handle.getAttribute("tabindex")).toBe("0");
    expect(handle.getAttribute("orientation")).toBe("vertical");
    expect(handle.getAttribute("min-size")).toBe("52");
    expect(handle.getAttribute("current-size")).toBe("240");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onKeyDown).toHaveBeenCalled();
  });
});
