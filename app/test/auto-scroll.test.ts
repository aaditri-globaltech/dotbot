import { describe, expect, it } from "vitest";
import { isAtBottom, scrollToBottom } from "../src/renderer/hooks/auto-scroll";

describe("auto scroll helpers", () => {
  it("treats a container within one pixel of the bottom as at the bottom", () => {
    expect(
      isAtBottom({ clientHeight: 100, scrollHeight: 400, scrollTop: 299 }),
    ).toBe(true);
    expect(
      isAtBottom({ clientHeight: 100, scrollHeight: 400, scrollTop: 298 }),
    ).toBe(false);
  });

  it("scrolls to the last visible line and never above zero", () => {
    const element = { clientHeight: 100, scrollHeight: 400, scrollTop: 0 };
    scrollToBottom(element);
    expect(element.scrollTop).toBe(300);

    const short = { clientHeight: 400, scrollHeight: 100, scrollTop: 10 };
    scrollToBottom(short);
    expect(short.scrollTop).toBe(0);
  });
});
