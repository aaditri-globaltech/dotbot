/** Session tabs shown in the window's top strip while the workbench is open. */

import { useProjectDir } from "../../hooks/useProjectDir";
import { useAgentStore } from "../../stores/agent-store";
import { ICON_BUTTON_CLASS } from "../panels/panel-classes";
import { statusDotClass } from "../panels/status-dot";

/** Render one tab per open session plus the new-task action. */
export function SessionTabs() {
  const sessions = useAgentStore((state) => state.sessions);
  const tabs = useAgentStore((state) => state.tabs);
  const selectedId = useAgentStore((state) => state.selectedId);
  const selectSession = useAgentStore((state) => state.selectSession);
  const closeTab = useAgentStore((state) => state.closeTab);
  const startNewTask = useAgentStore((state) => state.startNewTask);
  const projectDir = useProjectDir();

  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  return (
    <div className="flex min-w-0 items-stretch self-stretch overflow-x-auto [-webkit-app-region:no-drag]">
      {tabs.map((id) => {
        const session = sessionById.get(id);
        if (!session) return null;
        const active = session.id === selectedId;
        return (
          <div
            key={id}
            className="flex max-w-[220px] shrink-0 items-stretch border-r border-border"
          >
            <button
              type="button"
              className={`flex min-w-0 cursor-pointer items-center gap-1.5 overflow-hidden border-0 px-2 text-[11px] ${
                active ? "bg-surface text-secondary" : "bg-transparent text-dim"
              }`}
              onClick={() => selectSession(session.id)}
            >
              <span className={statusDotClass(session.status)} />
              <span className="truncate">{session.name ?? session.title}</span>
            </button>
            <button
              className={ICON_BUTTON_CLASS}
              type="button"
              dotbot-label={`Close ${session.name ?? session.title}`}
              onClick={() => closeTab(session.id)}
            >
              <span
                className="codicon codicon-close text-xs"
                dotbot-hidden="true"
              />
            </button>
          </div>
        );
      })}
      <button
        className={ICON_BUTTON_CLASS}
        type="button"
        dotbot-label="New task"
        title="New task"
        onClick={() => void startNewTask(projectDir)}
      >
        <span className="codicon codicon-add text-xs" dotbot-hidden="true" />
      </button>
    </div>
  );
}
