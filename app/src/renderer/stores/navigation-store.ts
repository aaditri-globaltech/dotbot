import { createStore } from "solid-js/store";

/** Screens selectable from the primary sidebar. */
export type Screen = "dashboard" | "workbench" | "manage";

/** What the sidebar shows below its navigation rows. */
export type SidebarMode = "sessions" | "files";

/** Pages selectable from the manage sidebar. */
export type ManagePage = "general" | "providers";

type NavigationState = {
  screen: Screen;
  sidebarMode: SidebarMode;
  managePage: ManagePage;
};

/** Screen and sidebar selection for the app chrome. */
export function createNavigationStore() {
  const [state, setState] = createStore<NavigationState>({
    screen: "dashboard",
    sidebarMode: "sessions",
    managePage: "general",
  });

  return {
    state,
    setScreen: (screen: Screen) => setState("screen", screen),
    setSidebarMode: (sidebarMode: SidebarMode) =>
      setState("sidebarMode", sidebarMode),
    setManagePage: (managePage: ManagePage) =>
      setState("managePage", managePage),
  };
}

/** Shared navigation store for the running app. */
export const navigationStore = createNavigationStore();
