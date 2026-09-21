/** Modal for an extension dialog request. */

import type { ExtensionRequest, ExtensionResponse } from "@dotbot/agent-core";
import { type ReactNode, useEffect, useState } from "react";
import { Dropdown } from "./Dropdown";
import { SECONDARY_BUTTON_CLASS } from "./panel-classes";

const DIALOG_INPUT_CLASS =
  "block w-full rounded-md border border-border-strong bg-surface " +
  "text-secondary outline-0 focus:border-focus";
const DIALOG_PRIMARY_CLASS =
  "min-w-[52px] cursor-pointer rounded-md border border-transparent " +
  "bg-secondary px-2.5 py-1 text-[11px] text-app hover:bg-primary";

export type ExtensionDialogProps = {
  request: ExtensionRequest;
  onRespond: (response: ExtensionResponse) => void;
};

/** Renders one agent dialog request and reports the chosen answer. */
export function ExtensionDialog(props: ExtensionDialogProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const request = props.request;
    setValue(
      request.method === "editor"
        ? (request.prefill ?? "")
        : request.method === "select"
          ? (request.options[0] ?? "")
          : "",
    );
  }, [props.request]);

  const cancel = () =>
    props.onRespond({
      type: "extension_ui_response",
      id: props.request.id,
      cancelled: true,
    });

  // Every method answers with Cancel plus its own choice, so the row is shared.
  const actions = (choice: ReactNode) => (
    <div className="mt-3.5 flex justify-end gap-1.5">
      <button className={SECONDARY_BUTTON_CLASS} type="button" onClick={cancel}>
        Cancel
      </button>
      {choice}
    </div>
  );

  const continueWithValue = (
    <button
      className={DIALOG_PRIMARY_CLASS}
      type="button"
      onClick={() =>
        props.onRespond({
          type: "extension_ui_response",
          id: props.request.id,
          value,
        })
      }
    >
      Continue
    </button>
  );

  return (
    <div className="absolute inset-0 z-5 grid place-items-center bg-black/45 p-5">
      <section
        className="w-[min(440px,100%)] rounded-lg border border-border-strong bg-card p-4 shadow-card"
        role="dialog"
        dotbot-modal="true"
      >
        <div className="mb-3 text-[13px] font-semibold text-secondary [white-space:pre-wrap]">
          {props.request.title}
        </div>
        {props.request.method === "select" && (
          <>
            <Dropdown
              label={props.request.title}
              value={value}
              options={props.request.options.map((option) => ({
                value: option,
                label: option,
              }))}
              onChange={setValue}
              variant="field"
            />
            {actions(continueWithValue)}
          </>
        )}
        {props.request.method === "confirm" && (
          <>
            <p className="mt-0 mr-0 mb-3.5 ml-0 text-xs leading-normal text-muted [white-space:pre-wrap]">
              {props.request.message}
            </p>
            {actions(
              <>
                <button
                  className={SECONDARY_BUTTON_CLASS}
                  type="button"
                  onClick={() =>
                    props.onRespond({
                      type: "extension_ui_response",
                      id: props.request.id,
                      confirmed: false,
                    })
                  }
                >
                  No
                </button>
                <button
                  className={DIALOG_PRIMARY_CLASS}
                  type="button"
                  onClick={() =>
                    props.onRespond({
                      type: "extension_ui_response",
                      id: props.request.id,
                      confirmed: true,
                    })
                  }
                >
                  Yes
                </button>
              </>,
            )}
          </>
        )}
        {(props.request.method === "input" ||
          props.request.method === "editor") && (
          <>
            <textarea
              className={`${DIALOG_INPUT_CLASS} resize-y p-1.5 text-xs leading-[1.4]`}
              rows={props.request.method === "editor" ? 8 : 3}
              placeholder={
                props.request.method === "input"
                  ? props.request.placeholder
                  : undefined
              }
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            {actions(continueWithValue)}
          </>
        )}
      </section>
    </div>
  );
}
