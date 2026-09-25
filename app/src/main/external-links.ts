/** The slice of Electron's webContents the external-link guard needs. */
export type LinkGuardContents = {
  getURL(): string;
  setWindowOpenHandler(
    handler: (details: { url: string }) => { action: "deny" },
  ): void;
  on(
    event: "will-navigate",
    listener: (event: { preventDefault(): void }, url: string) => void,
  ): void;
};

/** True for the schemes the system browser and mail client understand. */
function isExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return (
      protocol === "http:" || protocol === "https:" || protocol === "mailto:"
    );
  } catch {
    return false;
  }
}

/** Keep the app window on its own page and send links to the system browser. */
export function guardExternalLinks(
  contents: LinkGuardContents,
  openExternal: (url: string) => void,
): void {
  const openIfExternal = (url: string) => {
    if (isExternalUrl(url)) openExternal(url);
  };

  contents.setWindowOpenHandler(({ url }) => {
    openIfExternal(url);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    // A reload keeps the current URL, so only other navigations leave the app.
    if (url === contents.getURL()) return;
    event.preventDefault();
    openIfExternal(url);
  });
}
