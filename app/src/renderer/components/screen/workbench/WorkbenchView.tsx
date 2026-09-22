/** Workbench screen: the agent viewport plus the Git panel. */

import type { CSSProperties } from "react";
import { useProjectDir } from "../../../hooks/useProjectDir";
import type { ResizablePanels } from "../../../hooks/useResizablePanels";
import { useSessionStore } from "../../../stores/session-store";
import { useTrustStore } from "../../../stores/trust-store";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import { GitSidebar } from "../../panels/GitSidebar";
import { PanelHeader } from "../../panels/PanelHeader";
import { PanelResizer } from "../../panels/PanelResizer";
import { SessionView } from "../../panels/SessionView";

type WorkbenchViewProps = {
  panels: ResizablePanels;
};

/** Agent transcript and composer, with the Git panel docked below. */
export function WorkbenchView(props: WorkbenchViewProps) {
  const { panels } = props;
  const sessions = useSessionStore((state) => state.sessions);
  const selectedId = useSessionStore((state) => state.selectedId);
  const states = useSessionStore((state) => state.states);
  const newSession = useSessionStore((state) => state.newSession);
  const prompt = useSessionStore((state) => state.prompt);
  const runBash = useSessionStore((state) => state.runBash);
  const abort = useSessionStore((state) => state.abort);
  const setModel = useSessionStore((state) => state.setModel);
  const setThinkingLevel = useSessionStore((state) => state.setThinkingLevel);
  const respond = useSessionStore((state) => state.respond);
  const setDraft = useSessionStore((state) => state.setDraft);
  const projects = useWorkspaceStore((state) => state.projects);
  const selectProject = useWorkspaceStore((state) => state.selectProject);
  const trustDecisions = useTrustStore((state) => state.decisions);
  const trustRequest = useTrustStore((state) => state.requests[0]);
  const respondTrust = useTrustStore((state) => state.respond);

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const selectedSession = selectedId ? sessionById.get(selectedId) : undefined;
  const selectedState = selectedId ? states[selectedId] : undefined;
  const projectDir = useProjectDir();
  const noticeProjectDir = selectedSession?.projectDir ?? projectDir;
  const trustDecision = noticeProjectDir
    ? trustDecisions[noticeProjectDir]
    : undefined;

  return (
    <div
      className="view-area"
      style={{ "--panel-height": `${panels.panelHeight}px` } as CSSProperties}
    >
      <SessionView
        selectedSession={selectedSession}
        state={newSession ?? selectedState}
        drafting={newSession !== undefined}
        projects={projects}
        projectDir={projectDir}
        trustRequest={trustRequest}
        onRespondTrust={respondTrust}
        untrustedNotice={trustDecision === false}
        onSelectProject={selectProject}
        onDraft={setDraft}
        onPrompt={prompt}
        onRunBash={runBash}
        onAbort={abort}
        onSetModel={setModel}
        onSetThinkingLevel={setThinkingLevel}
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
