import type { CustomProviderInput, ProviderSummary } from "@dotbot/agent-core";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { api } from "../../../api";
import { errorMessage } from "../../../errors";
import { Dropdown, type DropdownOption } from "../../panels/Dropdown";
import { CustomProviderForm } from "./CustomProviderForm";
import {
  BUTTON_CLASS,
  CARD_CLASS,
  CARD_HINT_CLASS,
  CARD_TITLE_CLASS,
  INPUT_CLASS,
} from "./manage-classes";

/** List providers, manage their API keys, and add custom providers. */
export function ProvidersPage() {
  const [providers, setProviders] = createSignal<ProviderSummary[]>([]);
  const [selectedId, setSelectedId] = createSignal("");
  const [apiKey, setApiKey] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [creating, setCreating] = createSignal(false);
  const [notice, setNotice] = createSignal<string>();
  const [error, setError] = createSignal<string>();

  onMount(() => {
    let cancelled = false;
    api.providers
      .list()
      .then((list) => {
        if (!cancelled) setProviders(list);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      });
    onCleanup(() => {
      cancelled = true;
    });
  });

  const selected = () =>
    providers().find((provider) => provider.id === selectedId());

  const replaceProvider = (summary: ProviderSummary) => {
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
    const provider = selected();
    if (!provider || !apiKey().trim()) return;
    return run(async () => {
      replaceProvider(await api.providers.setKey(provider.id, apiKey()));
      setApiKey("");
      setNotice(`Saved ${provider.name} API key`);
    });
  };

  const remove = () => {
    const provider = selected();
    if (!provider) return;
    return run(async () => {
      replaceProvider(await api.providers.remove(provider.id));
      setNotice(`Removed ${provider.name} credential`);
    });
  };

  const addCustom = (provider: CustomProviderInput) =>
    run(async () => {
      const summary = await api.providers.add(provider);
      setProviders(await api.providers.list());
      setSelectedId(summary.id);
      setApiKey("");
      setCreating(false);
      setNotice(`Added ${summary.name}`);
    });

  return (
    <Show
      when={!creating()}
      fallback={
        <CustomProviderForm
          busy={busy()}
          error={error()}
          onCancel={() => {
            setCreating(false);
            setError(undefined);
          }}
          onSubmit={addCustom}
        />
      }
    >
      <section class="flex max-w-[560px] flex-col gap-3">
        <h2 class="text-base font-semibold">Providers</h2>
        <Show when={providers().length === 0 && !error()}>
          <p class="text-muted">No API-key providers were found.</p>
        </Show>
        <div class={CARD_CLASS}>
          <div class={CARD_TITLE_CLASS}>Provider</div>
          <p class={CARD_HINT_CLASS}>
            Choose the provider whose API key you want to manage.
          </p>
          <div class="mt-2.5 flex items-center gap-2">
            <Dropdown
              className="flex-1"
              label="Provider"
              value={selectedId()}
              placeholder="Select a provider"
              variant="field"
              searchable
              disabled={busy()}
              onChange={selectProvider}
              options={providers().map(
                (provider): DropdownOption => ({
                  value: provider.id,
                  label: provider.name,
                  trailing: provider.configured
                    ? { label: "Configured", tone: "success" }
                    : { label: "Unconfigured", tone: "muted" },
                }),
              )}
            />
            <button
              type="button"
              class={`${BUTTON_CLASS} shrink-0 whitespace-nowrap`}
              disabled={busy()}
              onClick={() => {
                setCreating(true);
                setNotice(undefined);
                setError(undefined);
              }}
            >
              Add custom provider
            </button>
          </div>
        </div>
        <Show when={selected()}>
          {(provider) => (
            <div class={CARD_CLASS}>
              <div class={CARD_TITLE_CLASS}>API key</div>
              <p class={CARD_HINT_CLASS}>
                Stored locally and sent only to {provider().name}.
              </p>
              <input
                type="password"
                class={`${INPUT_CLASS} mt-2.5`}
                value={apiKey()}
                disabled={busy()}
                onInput={(event) => setApiKey(event.currentTarget.value)}
              />
              <div class="mt-2.5 flex justify-end gap-2">
                <Show when={provider().configured}>
                  <button
                    type="button"
                    class={BUTTON_CLASS}
                    disabled={busy()}
                    onClick={() => void remove()}
                  >
                    Remove
                  </button>
                </Show>
                <button
                  type="button"
                  class={BUTTON_CLASS}
                  disabled={busy() || !apiKey().trim()}
                  onClick={() => void save()}
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </Show>
        <Show when={notice()}>
          {(message) => <p class="text-success">{message()}</p>}
        </Show>
        <Show when={error()}>
          {(failure) => (
            <p class="text-error" role="alert">
              {failure()}
            </p>
          )}
        </Show>
      </section>
    </Show>
  );
}
