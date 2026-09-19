// Deliberately tiny browser entrypoint: this catches bundler/module regressions.
import type { AgentSessionSummary } from "@dotbot/agent-core";
import { createElement } from "react";
import { createRoot } from "react-dom/client";

const session: AgentSessionSummary = {
  id: "smoke",
  cwd: "/tmp",
  title: "smoke",
  status: "idle",
  active: false,
  unread: false,
  lastActivity: new Date().toISOString(),
};

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(createElement("pre", null, session.title));
}
