/** App-level settings: project trust default and saved decisions. */

import type { DefaultProjectTrust } from "@dotbot/agent-core";
import { For, onMount, Show } from "solid-js";
import { trustStore } from "../../../stores/trust-store";
import {
  CARD_CLASS,
  CARD_HINT_CLASS,
  CARD_TITLE_CLASS,
  INPUT_CLASS,
} from "./manage-classes";

const TRUST_DEFAULTS: { value: DefaultProjectTrust; label: string }[] = [
  { value: "ask", label: "Ask" },
  { value: "always", label: "Always trust" },
  { value: "never", label: "Never trust" },
];

/** Trust fallback plus every saved project decision. */
export function GeneralPage() {
  onMount(() => {
    void trustStore.load();
  });

  return (
    <section class="flex max-w-[520px] flex-col gap-3">
      <h2 class="text-base font-semibold">General</h2>

      <div class={CARD_CLASS}>
        <label class={CARD_TITLE_CLASS} for="trust-default">
          Project trust
        </label>
        <p class={CARD_HINT_CLASS}>
          Asked when a session starts in a project with its own resources and no
          saved decision.
        </p>
        <select
          id="trust-default"
          class={`${INPUT_CLASS} mt-2`}
          value={trustStore.state.defaultTrust}
          onChange={(event) =>
            void trustStore.setDefault(
              event.currentTarget.value as DefaultProjectTrust,
            )
          }
        >
          <For each={TRUST_DEFAULTS}>
            {(option) => <option value={option.value}>{option.label}</option>}
          </For>
        </select>
      </div>

      <div class={CARD_CLASS}>
        <div class={CARD_TITLE_CLASS}>Saved decisions</div>
        <p class={CARD_HINT_CLASS}>
          Revoke to ask again the next time a session starts in that project.
        </p>
        <Show
          when={trustStore.state.entries.length > 0}
          fallback={<p class={CARD_HINT_CLASS}>No saved trust decisions.</p>}
        >
          <ul class="mt-2 flex flex-col gap-1.5">
            <For each={trustStore.state.entries}>
              {(entry) => (
                <li class="flex items-center gap-2 text-[12px]">
                  <span
                    class="min-w-0 flex-1 truncate text-secondary"
                    title={entry.path}
                  >
                    {entry.path}
                  </span>
                  <span class={entry.decision ? "text-muted" : "text-warning"}>
                    {entry.decision ? "Trusted" : "Untrusted"}
                  </span>
                  <button
                    class="cursor-pointer rounded-md border border-border-strong bg-surface-hover px-2 py-0.5 text-[11px] text-secondary hover:bg-elevated"
                    type="button"
                    onClick={() => void trustStore.revoke(entry.path)}
                  >
                    Revoke
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>

      <Show when={trustStore.state.error}>
        {(failure) => <p class="text-[12px] text-error">{failure()}</p>}
      </Show>
    </section>
  );
}
