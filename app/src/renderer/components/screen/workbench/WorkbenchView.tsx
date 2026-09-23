/** Workbench screen: the agent viewport plus the Git panel. */

import { Show } from "solid-js";
import { projectDir } from "../../../hooks/project-dir";
import type { ResizablePanels } from "../../../hooks/resizable-panels";
import { sessionStore } from "../../../stores/session-store";
import { trustStore } from "../../../stores/trust-store";
import { workspaceStore } from "../../../stores/workspace-store";
import { GitSidebar } from "../../panels/GitSidebar";
import { PanelHeader } from "../../panels/PanelHeader";
import { PanelResizer } from "../../panels/PanelResizer";
import { SessionView } from "../../panels/SessionView";

type WorkbenchViewProps = {
  panels: ResizablePanels;
};

/** Agent transcript and composer, with the Git panel docked below. */
export function WorkbenchView(props: WorkbenchViewProps) {
  const selectedSession = () => {
    const id = sessionStore.state.selectedId;
    return id
      ? sessionStore.state.sessions.find((session) => session.id === id)
      : undefined;
  };
  const selectedState = () => {
    const id = sessionStore.state.selectedId;
    return id ? sessionStore.state.states[id] : undefined;
  };
  const noticeProjectDir = () => selectedSession()?.projectDir ?? projectDir();
  const trustDecision = () => {
    const dir = noticeProjectDir();
    return dir ? trustStore.state.decisions[dir] : undefined;
  };

  return (
    <div
      class="view-area"
      style={{ "--panel-height": `${props.panels.panelHeight()}px` }}
    >
      <SessionView
        selectedSession={selectedSession()}
        state={sessionStore.state.newSession ?? selectedState()}
        drafting={sessionStore.state.newSession !== undefined}
        projects={workspaceStore.state.projects}
        projectDir={projectDir()}
        trustRequest={trustStore.state.requests[0]}
        onRespondTrust={trustStore.respond}
        untrustedNotice={trustDecision() === false}
        onSelectProject={workspaceStore.selectProject}
        onDraft={sessionStore.setDraft}
        onPrompt={sessionStore.prompt}
        onRunBash={sessionStore.runBash}
        onAbort={sessionStore.abort}
        onSetModel={sessionStore.setModel}
        onSetThinkingLevel={sessionStore.setThinkingLevel}
        onRespond={sessionStore.respond}
      />

      <PanelResizer
        target="bottom"
        value={props.panels.panelHeight()}
        label="Resize panel top border"
        controls="view panel"
        onPointerDown={(event) => props.panels.startResize("bottom", event)}
        onKeyDown={(event) => props.panels.handleKeyDown("bottom", event)}
      />

      <section
        id="panel"
        class={`panel bottom-panel border-t border-border bg-app ${props.panels.panelCollapsed() ? "is-collapsed" : ""}`}
      >
        <PanelHeader title="Git" />
        {/* Only the visible panel reads Git, so a collapsed panel costs nothing. */}
        <Show when={!props.panels.panelCollapsed()}>
          <GitSidebar projectDir={projectDir()} />
        </Show>
      </section>
    </div>
  );
}
