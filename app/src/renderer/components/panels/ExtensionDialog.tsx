/** Modal for an extension dialog request. */

import type { ExtensionRequest, ExtensionResponse } from "@dotbot/agent-core";
import {
  createEffect,
  createSignal,
  createUniqueId,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Dropdown } from "./Dropdown";
import { SECONDARY_BUTTON_CLASS } from "./panel-classes";

const DIALOG_INPUT_CLASS =
  "block w-full rounded-md border border-input-border bg-editor-background " +
  "text-foreground outline-0 focus:border-focusBorder";
const DIALOG_PRIMARY_CLASS =
  "min-w-[52px] cursor-pointer rounded-md border border-transparent " +
  "bg-foreground px-2.5 py-1 text-meta text-sideBar-background hover:bg-strongForeground";

/** The card is a native modal, so the top layer, the focus trap, and Escape
    come from the platform. `m-auto` restores the centring that the preflight
    margin reset takes away. */
const DIALOG_CLASS =
  "m-auto w-[min(440px,100%)] overscroll-contain rounded-lg border " +
  "border-input-border bg-editorWidget-background p-4 shadow-card " +
  "backdrop:bg-black/45";

export type ExtensionDialogProps = {
  request: ExtensionRequest;
  onRespond: (response: ExtensionResponse) => void;
};

/** The value a request starts with, per method. */
function initialValue(request: ExtensionRequest): string {
  return request.method === "editor"
    ? (request.prefill ?? "")
    : request.method === "select"
      ? (request.options[0] ?? "")
      : "";
}

/** Placeholder for the text methods; only `input` has one. */
function placeholderFor(request: ExtensionRequest): string | undefined {
  return request.method === "input" ? request.placeholder : undefined;
}

/** Renders one agent dialog request and reports the chosen answer. */
export function ExtensionDialog(props: ExtensionDialogProps) {
  const [value, setValue] = createSignal(initialValue(props.request));
  const titleId = createUniqueId();
  let dialog: HTMLDialogElement | undefined;
  // The manager can replace a pending request in place while this dialog stays
  // mounted: start over from the new request's own value, not the old one's.
  createEffect(() => {
    setValue(initialValue(props.request));
  });
  onMount(() => {
    dialog?.showModal();
    // The card takes no focus of its own, so land on its first control: the
    // field for input requests, the first action otherwise.
    dialog
      ?.querySelector<HTMLElement>(
        "button, input, textarea, select, [tabindex]",
      )
      ?.focus();
  });
  // The agent opens this card, so there is no trigger to hand focus back to:
  // remember what had focus and restore it when the card goes away.
  const previouslyFocused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  onCleanup(() => previouslyFocused?.focus());

  const cancel = () =>
    props.onRespond({
      type: "extension_ui_response",
      id: props.request.id,
      cancelled: true,
    });

  const respondWithValue = () =>
    props.onRespond({
      type: "extension_ui_response",
      id: props.request.id,
      value: value(),
    });

  // Every method answers with Cancel plus its own choice, so the row is shared.
  const actions = (choice: JSX.Element) => (
    <div class="mt-4 flex justify-end gap-1.5">
      <button class={SECONDARY_BUTTON_CLASS} type="button" onClick={cancel}>
        Cancel
      </button>
      {choice}
    </div>
  );

  const continueWithValue = (
    <button
      class={DIALOG_PRIMARY_CLASS}
      type="button"
      onClick={respondWithValue}
    >
      Continue
    </button>
  );

  const selectRequest = () =>
    props.request.method === "select" ? props.request : undefined;
  const confirmRequest = () =>
    props.request.method === "confirm" ? props.request : undefined;
  const textRequest = () =>
    props.request.method === "input" || props.request.method === "editor"
      ? props.request
      : undefined;

  return (
    // A native modal: it sits in the top layer, so the agent's question covers
    // the whole window and nothing behind it can be clicked until answered.
    <dialog
      ref={(element) => {
        dialog = element;
      }}
      class={DIALOG_CLASS}
      aria-labelledby={titleId}
      // Escape answers the request here rather than through the dialog's own
      // `cancel` event, so one key press cannot report the cancellation twice.
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        cancel();
      }}
    >
      <h2
        id={titleId}
        class="mb-3 text-body font-semibold text-foreground [white-space:pre-wrap]"
      >
        {props.request.title}
      </h2>

      <Show when={selectRequest()}>
        {(request) => (
          <>
            <Dropdown
              label={request().title}
              value={value()}
              options={request().options.map((option) => ({
                value: option,
                label: option,
              }))}
              onChange={setValue}
              variant="field"
            />
            {actions(continueWithValue)}
          </>
        )}
      </Show>

      <Show when={confirmRequest()}>
        {(request) => (
          <>
            <p class="mb-3 text-body leading-normal text-descriptionForeground [white-space:pre-wrap]">
              {request().message}
            </p>
            {actions(
              <>
                <button
                  class={SECONDARY_BUTTON_CLASS}
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
                  class={DIALOG_PRIMARY_CLASS}
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
      </Show>

      <Show when={textRequest()}>
        {(request) => (
          <>
            <textarea
              class={`${DIALOG_INPUT_CLASS} resize-y p-1.5 text-body leading-[1.4]`}
              rows={request().method === "editor" ? 8 : 3}
              placeholder={placeholderFor(request())}
              value={value()}
              onInput={(event) => setValue(event.currentTarget.value)}
            />
            {actions(continueWithValue)}
          </>
        )}
      </Show>
    </dialog>
  );
}
