/**
 * Gaps in jsdom that the renderer tests would otherwise have to work around in
 * production code. Chromium, and therefore the app, provides both.
 */
export {};

// `<dialog>` ships the `open` attribute but not `showModal`, so a mount cannot
// open the real modal: the app's own focus call is what the tests then verify.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  };
}

// The dropdown keeps its highlighted row in view. jsdom does not lay out, so
// there is nothing to scroll.
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView = () => undefined;
}
