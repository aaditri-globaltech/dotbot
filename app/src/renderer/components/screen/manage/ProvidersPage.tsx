import type {
  AgentCustomProviderInput,
  AgentProviderSummary,
} from "@dotbot/agent-core";
import { useEffect, useState } from "react";
import { api } from "../../../api";
import { errorMessage } from "../../../errors";
import { CustomProviderForm } from "./CustomProviderForm";
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
    <section className="screen-page">
      <h2>Providers</h2>
      {providers.length === 0 && !error && (
        <p className="screen-empty">No API-key providers were found.</p>
      )}
      <div className="provider-picker-row">
        <ProviderPicker
          providers={providers}
          selected={selected}
          onSelect={selectProvider}
        />
        <button
          type="button"
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
          <label className="manage-field">
            <span>API key</span>
            <input
              type="password"
              value={apiKey}
              disabled={busy}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </label>
          <div className="manage-actions">
            <button
              type="button"
              disabled={busy || !apiKey.trim()}
              onClick={() => void save()}
            >
              Save
            </button>
            {selected.configured && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove()}
              >
                Remove
              </button>
            )}
          </div>
        </>
      )}
      {notice && <p className="manage-notice">{notice}</p>}
      {error && (
        <p className="manage-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
