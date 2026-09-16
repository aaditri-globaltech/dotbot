import type { AgentSessionSummary } from "@dotbot/agent-core";

/** Status-bar shortcuts for sessions that are waiting on user input. */
export type StatusBarProps = {
  waitingSessions: AgentSessionSummary[];
  onSelectSession: (id: string) => void;
};

/** Render shortcuts for sessions waiting on feedback. */
export function StatusBar(props: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-bar-right">
        {props.waitingSessions.map((session) => (
          <button
            key={session.id}
            className="status-bar-notification"
            type="button"
            onClick={() => props.onSelectSession(session.id)}
            title={`Feedback needed: ${session.name ?? session.title}`}
          >
            <span
              className="codicon codicon-comment-discussion"
              dotbot-hidden="true"
            />
            <span className="status-bar-notification-label">
              {session.name ?? session.title}
            </span>
          </button>
        ))}
        {props.waitingSessions.length === 0 && (
          <span className="status-bar-idle">Dotbot</span>
        )}
      </div>
    </footer>
  );
}
