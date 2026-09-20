/** Workbench screen: the agent viewport plus the Git panel. */

import type { CSSProperties } from "react";
import { useProjectDir } from "../../../hooks/useProjectDir";
import type { ResizablePanels } from "../../../hooks/useResizablePanels";
import { useAgentStore } from "../../../stores/agent-store";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import { AgentView } from "../../panels/AgentView";
import { GitSidebar } from "../../panels/GitSidebar";
import { PanelHeader } from "../../panels/PanelHeader";
import { PanelResizer } from "../../panels/PanelResizer";

type WorkbenchViewProps = {
  panels: ResizablePanels;
};

/** Agent transcript and composer, with the Git panel docked below. */
export function WorkbenchView(props: WorkbenchViewProps) {
  const { panels } = props;
  const sessions = useAgentStore((state) => state.sessions);
  const selectedId = useAgentStore((state) => state.selectedId);
  const states = useAgentStore((state) => state.states);
  const template = useAgentStore((state) => state.template);
  const prompt = useAgentStore((state) => state.prompt);
  const abort = useAgentStore((state) => state.abort);
  const command = useAgentStore((state) => state.command);
  const respond = useAgentStore((state) => state.respond);
  const setDraft = useAgentStore((state) => state.setDraft);
  const projects = useWorkspaceStore((state) => state.projects);
  const selectProject = useWorkspaceStore((state) => state.selectProject);

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const selectedSession = selectedId ? sessionById.get(selectedId) : undefined;
  const selectedState = selectedId ? states[selectedId] : undefined;
  const projectDir = useProjectDir();

  return (
    <div
      className="view-area"
      style={{ "--panel-height": `${panels.panelHeight}px` } as CSSProperties}
    >
      <AgentView
        selectedSession={selectedSession}
        state={template ?? selectedState}
        drafting={template !== undefined}
        projects={projects}
        projectDir={projectDir}
        onSelectProject={selectProject}
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
        <PanelHeader title="Git" />
        {/* Only the visible panel reads Git, so a collapsed panel costs nothing. */}
        {!panels.panelCollapsed && <GitSidebar projectDir={projectDir} />}
      </section>
    </div>
  );
}
