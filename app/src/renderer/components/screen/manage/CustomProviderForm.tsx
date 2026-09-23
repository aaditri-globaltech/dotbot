import {
  type CustomProviderInput,
  PROVIDER_APIS,
  type ProviderApi,
} from "@dotbot/agent-core/types";
import { createMemo, createSignal, Show } from "solid-js";
import { Dropdown } from "../../panels/Dropdown";
import {
  BUTTON_CLASS,
  CARD_CLASS,
  CARD_HINT_CLASS,
  CARD_TITLE_CLASS,
  FIELD_CLASS,
  INPUT_CLASS,
} from "./manage-classes";

type CustomProviderFormProps = {
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onSubmit: (provider: CustomProviderInput) => void;
};

/** Collects the fields for a new custom provider entry. */
export function CustomProviderForm(props: CustomProviderFormProps) {
  const [id, setId] = createSignal("");
  const [baseUrl, setBaseUrl] = createSignal("");
  const [api, setApi] = createSignal<ProviderApi>("openai-completions");
  const [modelIds, setModelIds] = createSignal("");

  const models = createMemo(() =>
    modelIds()
      .split(/[\n,]/)
      .map((model) => model.trim())
      .filter(Boolean),
  );

  const valid = () =>
    id().trim() !== "" && baseUrl().trim() !== "" && models().length > 0;

  return (
    <form
      class="flex max-w-[560px] flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid() || props.busy) return;
        props.onSubmit({
          id: id().trim(),
          baseUrl: baseUrl().trim(),
          api: api(),
          models: models(),
        });
      }}
    >
      <h2 class="text-base font-semibold">Add custom provider</h2>
      <div class={CARD_CLASS}>
        <div class={CARD_TITLE_CLASS}>Connection</div>
        <p class={CARD_HINT_CLASS}>
          An OpenAI- or Anthropic-compatible endpoint reached over HTTP.
        </p>
        <div class="mt-2.5 flex flex-col gap-3">
          <label class={FIELD_CLASS}>
            <span>Provider id</span>
            <input
              class={INPUT_CLASS}
              value={id()}
              disabled={props.busy}
              placeholder="my-provider"
              onInput={(event) => setId(event.currentTarget.value)}
            />
          </label>
          <label class={FIELD_CLASS}>
            <span>Base URL</span>
            <input
              class={INPUT_CLASS}
              value={baseUrl()}
              disabled={props.busy}
              placeholder="http://localhost:11434/v1"
              onInput={(event) => setBaseUrl(event.currentTarget.value)}
            />
          </label>
          {/* A plain row, not a label: the dropdown owns its own accessible name. */}
          <div class={FIELD_CLASS}>
            <span>API type</span>
            <Dropdown
              label="API type"
              value={api()}
              disabled={props.busy}
              variant="field"
              onChange={setApi}
              options={PROVIDER_APIS.map((entry) => ({
                value: entry,
                label: entry,
              }))}
            />
          </div>
          <label class={FIELD_CLASS}>
            <span>Model ids (one per line)</span>
            <textarea
              class={INPUT_CLASS}
              rows={4}
              value={modelIds()}
              disabled={props.busy}
              placeholder={"llama3.1:8b\nqwen2.5-coder:7b"}
              onInput={(event) => setModelIds(event.currentTarget.value)}
            />
          </label>
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <button
            type="button"
            class={BUTTON_CLASS}
            disabled={props.busy}
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            class={BUTTON_CLASS}
            disabled={props.busy || !valid()}
          >
            Add provider
          </button>
        </div>
      </div>
      <Show when={props.error}>
        {(failure) => (
          <p class="text-error" role="alert">
            {failure()}
          </p>
        )}
      </Show>
    </form>
  );
}
