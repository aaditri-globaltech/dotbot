/** Workbench screen: the agent viewport plus the source-control panel. */

import type { CSSProperties } from "react";
import type { ResizablePanels } from "../../../hooks/useResizablePanels";
import { useWorkspaceCwd } from "../../../hooks/useWorkspaceCwd";
import { useAgentStore } from "../../../stores/agent-store";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import { AgentView } from "../../panels/AgentView";
import { PanelHeader } from "../../panels/PanelHeader";
import { PanelResizer } from "../../panels/PanelResizer";
import { SourceControlSidebar } from "../../panels/SourceControlSidebar";

type WorkbenchViewProps = {
  panels: ResizablePanels;
};

/** Agent transcript and composer, with source control docked below. */
export function WorkbenchView(props: WorkbenchViewProps) {
  const { panels } = props;
  const sessions = useAgentStore((state) => state.sessions);
  const tabs = useAgentStore((state) => state.tabs);
  const selectedId = useAgentStore((state) => state.selectedId);
  const states = useAgentStore((state) => state.states);
  const selectSession = useAgentStore((state) => state.selectSession);
  const closeTab = useAgentStore((state) => state.closeTab);
  const createSession = useAgentStore((state) => state.createSession);
  const prompt = useAgentStore((state) => state.prompt);
  const abort = useAgentStore((state) => state.abort);
  const command = useAgentStore((state) => state.command);
  const respond = useAgentStore((state) => state.respond);
  const setDraft = useAgentStore((state) => state.setDraft);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const selectWorkspace = useWorkspaceStore((state) => state.selectWorkspace);

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const tabSessions = tabs.flatMap((id) => {
    const session = sessionById.get(id);
    return session ? [session] : [];
  });
  const selectedSession = selectedId ? sessionById.get(selectedId) : undefined;
  const selectedState = selectedId ? states[selectedId] : undefined;
  const workspaceCwd = useWorkspaceCwd();

  return (
    <div
      className="view-area"
      style={{ "--panel-height": `${panels.panelHeight}px` } as CSSProperties}
    >
      <AgentView
        tabs={tabSessions}
        selectedSession={selectedSession}
        state={selectedState}
        workspaces={workspaces}
        workspaceCwd={workspaceCwd}
        onSelectWorkspace={selectWorkspace}
        onSelectTab={selectSession}
        onCloseTab={closeTab}
        onNewSession={() => void createSession(workspaceCwd ?? "")}
        onDraft={setDraft}
        onPrompt={prompt}
        onAbort={abort}
        onCommand={command}
        onRespond={respond}
      />

      <PanelResizer
        target="bottom"
        value={panels.panelHeight}
        label="Resize panel top border"
        controls="view panel"
        onPointerDown={(event) => panels.startResize("bottom", event)}
        onKeyDown={(event) => panels.handleKeyDown("bottom", event)}
      />

      <section
        id="panel"
        className={`panel bottom-panel border-t border-border bg-app ${panels.panelCollapsed ? "is-collapsed" : ""}`}
      >
        <PanelHeader title="Source Control" />
        {/* Only the visible panel reads Git, so a collapsed panel costs nothing. */}
        {!panels.panelCollapsed && <SourceControlSidebar cwd={workspaceCwd} />}
      </section>
    </div>
  );
}
