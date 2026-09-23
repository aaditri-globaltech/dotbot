// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Dropdown,
  type DropdownOption,
} from "../src/renderer/components/panels/Dropdown";

// @solidjs/testing-library only registers its automatic cleanup when Vitest runs
// with `globals: true`, which this repository does not use.
afterEach(cleanup);

const options: DropdownOption[] = [
  { value: "a", label: "Alpha", description: "/projects/a" },
  { value: "b", label: "Beta", description: "/projects/b" },
  { value: "c", label: "Gamma" },
];

// The trigger's accessible name comes from the hidden label, which lands one
// render after mount, so every lookup awaits it.
const trigger = (name: RegExp | string = /Project/) =>
  screen.findByRole("button", { name });

/** Open the menu the way a pointer does. */
async function clickTrigger(name: RegExp | string = /Project/) {
  fireEvent.pointerDown(await trigger(name), {
    pointerType: "mouse",
    button: 0,
  });
}

/** The option Kobalte moved focus to after the menu opened. */
function focusedOption(): Element {
  const active = document.activeElement;
  if (!(active instanceof Element)) throw new Error("no focused element");
  return active;
}

describe("Dropdown", () => {
  it("lists every option when the trigger is clicked", async () => {
    render(() => (
      <Dropdown
        label="Project"
        value="a"
        options={options}
        onChange={() => undefined}
      />
    ));

    await clickTrigger();

    expect(await screen.findByRole("listbox")).toBeTruthy();
    for (const option of options) {
      expect(screen.getByRole("option", { name: option.label })).toBeTruthy();
    }
  });

  it("picks an option with the mouse", async () => {
    const onChange = vi.fn();
    render(() => (
      <Dropdown
        label="Project"
        value="a"
        options={options}
        onChange={onChange}
      />
    ));

    await clickTrigger();
    fireEvent.click(await screen.findByRole("option", { name: /Beta/ }));

    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("opens from the keyboard and selects the highlighted option", async () => {
    const onChange = vi.fn();
    render(() => (
      <Dropdown
        label="Project"
        value="a"
        options={options}
        onChange={onChange}
      />
    ));

    const button = await trigger();
    // Tab reaches the trigger: it is the only control while the menu is closed.
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: "ArrowDown" });
    await screen.findByRole("listbox");
    // The menu takes focus when it mounts, so its keys reach Kobalte.
    fireEvent.keyDown(focusedOption(), { key: "ArrowDown" });
    fireEvent.keyDown(focusedOption(), { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("b");
    // and closing hands focus back to the trigger.
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it("closes on Escape without changing the value", async () => {
    const onChange = vi.fn();
    render(() => (
      <Dropdown
        label="Project"
        value="a"
        options={options}
        onChange={onChange}
      />
    ));

    await clickTrigger();
    await screen.findByRole("listbox");
    fireEvent.keyDown(focusedOption(), { key: "Escape" });

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("keeps a dropdown chevron on the trigger", async () => {
    render(() => (
      <Dropdown
        label="Provider"
        value=""
        options={options}
        onChange={() => undefined}
        searchable
      />
    ));

    // Without the chevron the control reads as a plain search box.
    const button = await trigger(/Provider/);
    expect(button.querySelector(".codicon-chevron-down")).not.toBeNull();
  });

  it("does not open when disabled", async () => {
    render(() => (
      <Dropdown
        label="Project"
        value="a"
        options={options}
        onChange={() => undefined}
        disabled
      />
    ));

    const button = await trigger();
    fireEvent.pointerDown(button, { pointerType: "mouse", button: 0 });
    fireEvent.keyDown(button, { key: "ArrowDown" });

    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  describe("searchable", () => {
    const renderSearchable = (value = "b") =>
      render(() => (
        <Dropdown
          label="Provider"
          value={value}
          options={options}
          onChange={() => undefined}
          searchable
        />
      ));

    it("names the trigger after the control, not Kobalte's default", async () => {
      renderSearchable();

      // The hidden label joins the visible value in the accessible name.
      expect(
        await screen.findByRole("button", { name: "Provider Beta" }),
      ).toBeTruthy();
    });

    it("turns the trigger into the search field while open", async () => {
      renderSearchable();

      await clickTrigger(/Provider/);
      const field = (await screen.findByPlaceholderText(
        "Search Provider",
      )) as HTMLInputElement;

      // The trigger is replaced, the field takes focus, and its text is
      // selected so typing replaces the current value.
      expect(screen.queryByRole("button", { name: /Provider/ })).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(field));
      expect(field.selectionStart).toBe(0);
      expect(field.selectionEnd).toBe(field.value.length);

      fireEvent.keyDown(field, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
      expect(await trigger(/Provider/)).toBeTruthy();
    });

    it("keeps the selected label on the trigger, not in a search box", async () => {
      renderSearchable();

      expect(screen.queryByPlaceholderText("Search Provider")).toBeNull();
      expect((await trigger(/Provider/)).textContent).toContain("Beta");
    });

    it("lists every option until the text is edited", async () => {
      renderSearchable();

      await clickTrigger(/Provider/);
      await screen.findByRole("listbox");
      for (const option of options) {
        expect(screen.getByRole("option", { name: option.label })).toBeTruthy();
      }
    });

    it("narrows the list by label, value, or description", async () => {
      renderSearchable();

      await clickTrigger(/Provider/);
      const field = await screen.findByPlaceholderText("Search Provider");
      fireEvent.input(field, { target: { value: "projects/a" } });

      expect(await screen.findByRole("option", { name: "Alpha" })).toBeTruthy();
      expect(screen.queryByRole("option", { name: "Gamma" })).toBeNull();
    });
  });
});
