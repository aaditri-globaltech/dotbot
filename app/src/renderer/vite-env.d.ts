/// <reference types="vite/client" />

import type { DotbotApi } from "./api";

declare global {
  interface Window {
    dotbot: DotbotApi;
  }
}
