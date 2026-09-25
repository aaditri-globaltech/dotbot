/// <reference types="vite/client" />

import type { BotApi } from "./api";

declare global {
  interface Window {
    dotbot: BotApi;
  }
}
