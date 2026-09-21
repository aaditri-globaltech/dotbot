/** App-level settings: project trust default and saved decisions. */

import type { DefaultProjectTrust } from "@dotbot/agent-core";
import { useEffect } from "react";
import { useTrustStore } from "../../../stores/trust-store";
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
  const defaultTrust = useTrustStore((state) => state.defaultTrust);
  const entries = useTrustStore((state) => state.entries);
  const error = useTrustStore((state) => state.error);
  const load = useTrustStore((state) => state.load);
  const setDefault = useTrustStore((state) => state.setDefault);
  const revoke = useTrustStore((state) => state.revoke);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="flex max-w-[520px] flex-col gap-3">
      <h2 className="text-base font-semibold">General</h2>

      <div className={CARD_CLASS}>
        <label className={CARD_TITLE_CLASS} htmlFor="trust-default">
          Project trust
        </label>
        <p className={CARD_HINT_CLASS}>
          Asked when a session starts in a project with its own resources and no
          saved decision.
        </p>
        <select
          id="trust-default"
          className={`${INPUT_CLASS} mt-2`}
          value={defaultTrust}
          onChange={(event) =>
            void setDefault(event.target.value as DefaultProjectTrust)
          }
        >
          {TRUST_DEFAULTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={CARD_CLASS}>
        <div className={CARD_TITLE_CLASS}>Saved decisions</div>
        <p className={CARD_HINT_CLASS}>
          Revoke to ask again the next time a session starts in that project.
        </p>
        {entries.length === 0 ? (
          <p className={CARD_HINT_CLASS}>No saved trust decisions.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {entries.map((entry) => (
              <li
                key={entry.path}
                className="flex items-center gap-2 text-[12px]"
              >
                <span
                  className="min-w-0 flex-1 truncate text-secondary"
                  title={entry.path}
                >
                  {entry.path}
                </span>
                <span
                  className={entry.decision ? "text-muted" : "text-warning"}
                >
                  {entry.decision ? "Trusted" : "Untrusted"}
                </span>
                <button
                  className="cursor-pointer rounded-md border border-border-strong bg-surface-hover px-2 py-0.5 text-[11px] text-secondary hover:bg-elevated"
                  type="button"
                  onClick={() => void revoke(entry.path)}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-[12px] text-error">{error}</p>}
    </section>
  );
}
