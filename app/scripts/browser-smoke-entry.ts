// Deliberately tiny browser entrypoint: this catches bundler/module regressions.
// Deliberately free of JSX too: Solid's `jsx-runtime` export is types-only, so
// esbuild's automatic runtime cannot compile Solid JSX. Vite compiles it with
// babel-preset-solid instead, which is why this entry builds its element by hand.
import type { SessionSummary } from "@dotbot/agent-core";
import { render } from "solid-js/web";

const session: SessionSummary = {
  id: "smoke",
  projectDir: "/tmp",
  title: "smoke",
  status: "idle",
  active: false,
  unread: false,
  lastActivity: new Date().toISOString(),
};

const root = document.getElementById("root");
if (root) {
  const line = document.createElement("pre");
  line.textContent = session.title;
  render(() => line, root);
}
