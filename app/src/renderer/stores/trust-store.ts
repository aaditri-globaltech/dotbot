/** Renderer state for project trust prompts and decisions. */

import type {
  AgentManagerEvent,
  DefaultProjectTrust,
  ExtensionResponse,
  TrustDecisionEntry,
  TrustRequest,
} from "@dotbot/agent-core";
import { create } from "zustand";
import { api } from "../api";

type TrustStore = {
  /** Pending dialogs, oldest first; the app renders the head. */
  requests: TrustRequest[];
  /** Run-time decisions reported by the main process, keyed by project. */
  decisions: Record<string, boolean>;
  /** Saved decisions shown by Manage. */
  entries: TrustDecisionEntry[];
  /** Global fallback used when a project has no saved decision. */
  defaultTrust: DefaultProjectTrust;
  /** Latest Manage load or mutation failure. */
  error?: string;
  respond: (response: ExtensionResponse) => void;
  applyEvent: (event: AgentManagerEvent) => void;
  subscribe: () => () => void;
  load: () => Promise<void>;
  setDefault: (value: DefaultProjectTrust) => Promise<void>;
  revoke: (path: string) => Promise<void>;
};

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** App-level trust prompt, decision, and Manage state. */
export const useTrustStore = create<TrustStore>((set, get) => ({
  requests: [],
  decisions: {},
  entries: [],
  defaultTrust: "ask",

  respond: (response) => {
    void api.agent
      .respondTrust(response)
      .catch((error: unknown) => console.error(error))
      .finally(() =>
        set((current) => ({
          requests: current.requests.filter(
            (request) => request.id !== response.id,
          ),
        })),
      );
  },

  applyEvent: (event) => {
    if (event.type === "trust_request") {
      set((current) => ({ requests: [...current.requests, event.request] }));
      return;
    }
    if (event.type === "trust_update") {
      set((current) => ({
        decisions: {
          ...current.decisions,
          [event.projectDir]: event.decision,
        },
      }));
    }
  },

  subscribe: () => api.agent.onEvent((event) => get().applyEvent(event)),

  load: async () => {
    try {
      const [defaultTrust, entries] = await Promise.all([
        api.trust.getDefault(),
        api.trust.list(),
      ]);
      set({ defaultTrust, entries, error: undefined });
    } catch (error) {
      set({ error: messageFor(error) });
    }
  },

  setDefault: async (value) => {
    try {
      await api.trust.setDefault(value);
      set({ defaultTrust: value, error: undefined });
    } catch (error) {
      set({ error: messageFor(error) });
    }
  },

  revoke: async (path) => {
    try {
      await api.trust.revoke(path);
      set({ entries: await api.trust.list(), error: undefined });
    } catch (error) {
      set({ error: messageFor(error) });
    }
  },
}));
