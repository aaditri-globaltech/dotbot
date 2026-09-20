import { create } from "zustand";

/** Screens selectable from the primary sidebar. */
export type Screen = "dashboard" | "workbench" | "manage";

/** What the sidebar shows below its navigation rows. */
export type SidebarMode = "sessions" | "files";

/** Pages selectable from the manage sidebar. */
export type ManagePage = "general" | "providers";

type NavigationStore = {
  screen: Screen;
  sidebarMode: SidebarMode;
  managePage: ManagePage;
  setScreen: (screen: Screen) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setManagePage: (page: ManagePage) => void;
};

/** Screen and sidebar selection for the app chrome. */
export const useNavigationStore = create<NavigationStore>((set) => ({
  screen: "dashboard",
  sidebarMode: "sessions",
  managePage: "general",

  setScreen: (screen) => set({ screen }),

  setSidebarMode: (mode) => set({ sidebarMode: mode }),

  setManagePage: (page) => set({ managePage: page }),
}));
