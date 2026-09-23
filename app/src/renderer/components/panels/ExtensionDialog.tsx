/** Modal for an extension dialog request. */

import type { ExtensionRequest, ExtensionResponse } from "@dotbot/agent-core";
import { Dialog } from "@kobalte/core/dialog";
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from "solid-js";
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
  // The manager can replace a pending request in place while this dialog stays
  // mounted: start over from the new request's own value, not the old one's.
  createEffect(() => {
    setValue(initialValue(props.request));
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
    <div class="mt-3.5 flex justify-end gap-1.5">
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
    // Rendered inline, not through Dialog.Portal, so the overlay keeps covering
    // only the view panel instead of the whole window.
    <Dialog
      open
      modal
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      <Dialog.Overlay class="absolute inset-0 z-5 grid place-items-center bg-black/45 p-5">
        <Dialog.Content
          class="w-[min(440px,100%)] rounded-lg border border-border-strong bg-card p-4 shadow-card"
          modal="true"
          // Focus is restored by this component's own cleanup, not by Kobalte's
          // trigger lookup (there is no trigger element).
          onCloseAutoFocus={(event) => event.preventDefault()}
          // A stray click outside must not answer the agent's request for us.
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <Dialog.Title class="mb-3 text-[13px] font-semibold text-secondary [white-space:pre-wrap]">
            {props.request.title}
          </Dialog.Title>

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
                <Dialog.Description class="mt-0 mr-0 mb-3.5 ml-0 text-xs leading-normal text-muted [white-space:pre-wrap]">
                  {request().message}
                </Dialog.Description>
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
                  class={`${DIALOG_INPUT_CLASS} resize-y p-1.5 text-xs leading-[1.4]`}
                  rows={request().method === "editor" ? 8 : 3}
                  placeholder={placeholderFor(request())}
                  value={value()}
                  onInput={(event) => setValue(event.currentTarget.value)}
                />
                {actions(continueWithValue)}
              </>
            )}
          </Show>
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog>
  );
}
