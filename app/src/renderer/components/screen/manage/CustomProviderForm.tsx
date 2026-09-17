import {
  AGENT_PROVIDER_APIS,
  type AgentCustomProviderInput,
  type AgentProviderApi,
} from "@dotbot/agent-core/types";
import { useState } from "react";

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
      className="screen-page"
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
      <h2>Add custom provider</h2>
      <label className="manage-field">
        <span>Provider id</span>
        <input
          value={id}
          disabled={props.busy}
          placeholder="my-provider"
          onChange={(event) => setId(event.target.value)}
        />
      </label>
      <label className="manage-field">
        <span>Base URL</span>
        <input
          value={baseUrl}
          disabled={props.busy}
          placeholder="http://localhost:11434/v1"
          onChange={(event) => setBaseUrl(event.target.value)}
        />
      </label>
      <label className="manage-field">
        <span>API type</span>
        <select
          value={api}
          disabled={props.busy}
          onChange={(event) => setApi(event.target.value as AgentProviderApi)}
        >
          {AGENT_PROVIDER_APIS.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </label>
      <label className="manage-field">
        <span>Model ids (one per line)</span>
        <textarea
          rows={4}
          value={modelIds}
          disabled={props.busy}
          placeholder={"llama3.1:8b\nqwen2.5-coder:7b"}
          onChange={(event) => setModelIds(event.target.value)}
        />
      </label>
      <div className="manage-actions">
        <button type="submit" disabled={props.busy || !valid}>
          Add provider
        </button>
        <button type="button" disabled={props.busy} onClick={props.onCancel}>
          Cancel
        </button>
      </div>
      {props.error && (
        <p className="manage-error" role="alert">
          {props.error}
        </p>
      )}
    </form>
  );
}
