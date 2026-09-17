import type {
  AgentCustomProviderInput,
  AgentProviderSummary,
} from "@dotbot/agent-core";
import { useEffect, useState } from "react";
import { api } from "../../../api";
import { errorMessage } from "../../../errors";
import { CustomProviderForm } from "./CustomProviderForm";
import { BUTTON_CLASS, FIELD_CLASS, INPUT_CLASS } from "./manage-classes";
import { ProviderPicker } from "./ProviderPicker";

/** List providers, manage their API keys, and add custom providers. */
export function ProvidersPage() {
  const [providers, setProviders] = useState<AgentProviderSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    api.providers
      .list()
      .then((list) => {
        if (!cancelled) setProviders(list);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = providers.find((provider) => provider.id === selectedId);

  const replaceProvider = (summary: AgentProviderSummary) => {
    setProviders((current) =>
      current.map((provider) =>
        provider.id === summary.id ? summary : provider,
      ),
    );
  };

  const selectProvider = (id: string) => {
    setSelectedId(id);
    setApiKey("");
    setNotice(undefined);
    setError(undefined);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice(undefined);
    setError(undefined);
    try {
      await action();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!selected || !apiKey.trim()) return;
    return run(async () => {
      replaceProvider(await api.providers.setKey(selected.id, apiKey));
      setApiKey("");
      setNotice(`Saved ${selected.name} API key`);
    });
  };

  const remove = () => {
    if (!selected) return;
    return run(async () => {
      replaceProvider(await api.providers.remove(selected.id));
      setNotice(`Removed ${selected.name} credential`);
    });
  };

  const addCustom = (provider: AgentCustomProviderInput) =>
    run(async () => {
      const summary = await api.providers.add(provider);
      setProviders(await api.providers.list());
      setSelectedId(summary.id);
      setApiKey("");
      setCreating(false);
      setNotice(`Added ${summary.name}`);
    });

  if (creating) {
    return (
      <CustomProviderForm
        busy={busy}
        error={error}
        onCancel={() => {
          setCreating(false);
          setError(undefined);
        }}
        onSubmit={addCustom}
      />
    );
  }

  return (
    <section className="flex max-w-[520px] flex-col gap-3">
      <h2 className="text-base font-semibold">Providers</h2>
      {providers.length === 0 && !error && (
        <p className="text-muted">No API-key providers were found.</p>
      )}
      <div className="flex items-center gap-2">
        <ProviderPicker
          providers={providers}
          selected={selected}
          onSelect={selectProvider}
        />
        <button
          type="button"
          className={`${BUTTON_CLASS} shrink-0 whitespace-nowrap`}
          disabled={busy}
          onClick={() => {
            setCreating(true);
            setNotice(undefined);
            setError(undefined);
          }}
        >
          Add custom provider
        </button>
      </div>
      {selected && (
        <>
          <label className={FIELD_CLASS}>
            <span>API key</span>
            <input
              type="password"
              className={INPUT_CLASS}
              value={apiKey}
              disabled={busy}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className={BUTTON_CLASS}
              disabled={busy || !apiKey.trim()}
              onClick={() => void save()}
            >
              Save
            </button>
            {selected.configured && (
              <button
                type="button"
                className={BUTTON_CLASS}
                disabled={busy}
                onClick={() => void remove()}
              >
                Remove
              </button>
            )}
          </div>
        </>
      )}
      {notice && <p className="text-success">{notice}</p>}
      {error && (
        <p className="text-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
