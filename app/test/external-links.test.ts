import { describe, expect, it } from "vitest";
import {
  guardExternalLinks,
  type LinkGuardContents,
} from "../src/main/external-links";

/** Fake webContents, guarded already, that records what each event did. */
function createGuard(currentUrl: string) {
  const prevented: string[] = [];
  const opened: string[] = [];
  let windowOpenHandler:
    | ((details: { url: string }) => { action: "deny" })
    | undefined;
  let navigate:
    | ((event: { preventDefault: () => void }, url: string) => void)
    | undefined;
  const contents: LinkGuardContents = {
    getURL: () => currentUrl,
    setWindowOpenHandler: (handler) => {
      windowOpenHandler = handler;
    },
    on: (_event, listener) => {
      navigate = listener;
    },
  };
  guardExternalLinks(contents, (url) => opened.push(url));
  return {
    opened,
    prevented,
    open: (url: string) => windowOpenHandler?.({ url }),
    navigateTo: (url: string) =>
      navigate?.({ preventDefault: () => prevented.push(url) }, url),
  };
}

describe("guardExternalLinks", () => {
  it("opens web links in the system browser instead of the app", () => {
    const guard = createGuard("file:///app/index.html");

    guard.navigateTo("https://example.com/docs");
    guard.navigateTo("mailto:team@example.com");

    expect(guard.prevented).toEqual([
      "https://example.com/docs",
      "mailto:team@example.com",
    ]);
    expect(guard.opened).toEqual([
      "https://example.com/docs",
      "mailto:team@example.com",
    ]);
  });

  it("denies new windows for web links and opens them instead", () => {
    const guard = createGuard("file:///app/index.html");

    const response = guard.open("https://example.com/docs");

    expect(response).toEqual({ action: "deny" });
    expect(guard.opened).toEqual(["https://example.com/docs"]);
  });

  it("leaves a reload of the current URL in the app", () => {
    const guard = createGuard("file:///app/index.html");

    guard.navigateTo("file:///app/index.html");

    expect(guard.prevented).toEqual([]);
    expect(guard.opened).toEqual([]);
  });

  it("blocks navigation to schemes the browser must not open", () => {
    const guard = createGuard("file:///app/index.html");

    guard.navigateTo("file:///etc/passwd");
    guard.navigateTo("javascript:alert(1)");

    expect(guard.prevented).toEqual([
      "file:///etc/passwd",
      "javascript:alert(1)",
    ]);
    expect(guard.opened).toEqual([]);
  });
});
