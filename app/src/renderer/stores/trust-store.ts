/** Renderer state for project trust prompts and decisions. */

import type {
  AgentManagerEvent,
  DefaultProjectTrust,
  ExtensionResponse,
  TrustDecisionEntry,
  TrustRequest,
} from "@dotbot/agent-core";
import { createStore } from "solid-js/store";
import { api } from "../api";
import { errorMessage } from "../errors";

type TrustState = {
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
};

/** App-level trust prompt, decision, and Manage state. */
export function createTrustStore() {
  const [state, setState] = createStore<TrustState>({
    requests: [],
    decisions: {},
    entries: [],
    defaultTrust: "ask",
  });

  const respond = (response: ExtensionResponse) => {
    void api.agent
      .respondTrust(response)
      .catch((error: unknown) => console.error(error))
      .finally(() =>
        setState("requests", (requests) =>
          requests.filter((request) => request.id !== response.id),
        ),
      );
  };

  const applyEvent = (event: AgentManagerEvent) => {
    if (event.type === "trust_request") {
      setState("requests", (requests) => [...requests, event.request]);
      return;
    }
    if (event.type === "trust_update") {
      setState("decisions", event.projectDir, event.decision);
    }
  };

  return {
    state,
    respond,
    applyEvent,

    subscribe: () => api.agent.onEvent((event) => applyEvent(event)),

    load: async () => {
      try {
        const [defaultTrust, entries] = await Promise.all([
          api.trust.getDefault(),
          api.trust.list(),
        ]);
        setState({ defaultTrust, entries, error: undefined });
      } catch (error) {
        setState("error", errorMessage(error));
      }
    },

    setDefault: async (value: DefaultProjectTrust) => {
      try {
        await api.trust.setDefault(value);
        setState({ defaultTrust: value, error: undefined });
      } catch (error) {
        setState("error", errorMessage(error));
      }
    },

    revoke: async (path: string) => {
      try {
        await api.trust.revoke(path);
        setState({ entries: await api.trust.list(), error: undefined });
      } catch (error) {
        setState("error", errorMessage(error));
      }
    },
  };
}

/** Shared trust store for the running app. */
export const trustStore = createTrustStore();
