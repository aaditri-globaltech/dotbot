import {
  AGENT_PROVIDER_APIS,
  type AgentCustomProviderInput,
  type AgentProviderApi,
} from "@dotbot/agent-core/types";
import { useState } from "react";
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
  onSubmit: (provider: AgentCustomProviderInput) => void;
};

/** Collects the fields for a new custom provider entry. */
export function CustomProviderForm(props: CustomProviderFormProps) {
  const [id, setId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [api, setApi] = useState<AgentProviderApi>("openai-completions");
  const [modelIds, setModelIds] = useState("");

  const models = modelIds
    .split(/[\n,]/)
    .map((model) => model.trim())
    .filter(Boolean);

  const valid = id.trim() !== "" && baseUrl.trim() !== "" && models.length > 0;

  return (
    <form
      className="flex max-w-[560px] flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || props.busy) return;
        props.onSubmit({
          id: id.trim(),
          baseUrl: baseUrl.trim(),
          api,
          models,
        });
      }}
    >
      <h2 className="text-base font-semibold">Add custom provider</h2>
      <div className={CARD_CLASS}>
        <div className={CARD_TITLE_CLASS}>Connection</div>
        <p className={CARD_HINT_CLASS}>
          An OpenAI- or Anthropic-compatible endpoint reached over HTTP.
        </p>
        <div className="mt-2.5 flex flex-col gap-3">
          <label className={FIELD_CLASS}>
            <span>Provider id</span>
            <input
              className={INPUT_CLASS}
              value={id}
              disabled={props.busy}
              placeholder="my-provider"
              onChange={(event) => setId(event.target.value)}
            />
          </label>
          <label className={FIELD_CLASS}>
            <span>Base URL</span>
            <input
              className={INPUT_CLASS}
              value={baseUrl}
              disabled={props.busy}
              placeholder="http://localhost:11434/v1"
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          </label>
          {/* A plain row, not a label: the dropdown owns its own accessible name. */}
          <div className={FIELD_CLASS}>
            <span>API type</span>
            <Dropdown
              label="API type"
              value={api}
              disabled={props.busy}
              variant="field"
              onChange={setApi}
              options={AGENT_PROVIDER_APIS.map((entry) => ({
                value: entry,
                label: entry,
              }))}
            />
          </div>
          <label className={FIELD_CLASS}>
            <span>Model ids (one per line)</span>
            <textarea
              className={INPUT_CLASS}
              rows={4}
              value={modelIds}
              disabled={props.busy}
              placeholder={"llama3.1:8b\nqwen2.5-coder:7b"}
              onChange={(event) => setModelIds(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className={BUTTON_CLASS}
            disabled={props.busy}
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={BUTTON_CLASS}
            disabled={props.busy || !valid}
          >
            Add provider
          </button>
        </div>
      </div>
      {props.error && (
        <p className="text-error" role="alert">
          {props.error}
        </p>
      )}
    </form>
  );
}
