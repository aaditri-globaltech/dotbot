import type { AgentSessionSummary } from "@dotbot/agent-core";

/** Status-bar shortcuts for sessions that are waiting on user input. */
export type StatusBarProps = {
  waitingSessions: AgentSessionSummary[];
  onSelectSession: (id: string) => void;
};

/** Render shortcuts for sessions waiting on feedback. */
export function StatusBar(props: StatusBarProps) {
  return (
    <footer className="flex min-w-0 items-center justify-end border-t border-border bg-app px-2">
      <div className="flex h-full min-w-0 items-center gap-2">
        {props.waitingSessions.map((session) => (
          <button
            key={session.id}
            className="flex h-[18px] max-w-[240px] cursor-pointer items-center gap-1.5 border-0 bg-transparent px-1.5 text-[10px] text-warning hover:bg-control hover:text-primary"
            type="button"
            onClick={() => props.onSelectSession(session.id)}
            title={`Feedback needed: ${session.name ?? session.title}`}
          >
            <span
              className="codicon codicon-comment-discussion"
              dotbot-hidden="true"
            />
            <span className="truncate">{session.name ?? session.title}</span>
          </button>
        ))}
        {props.waitingSessions.length === 0 && (
          <span className="text-[10px] text-faint">Dotbot</span>
        )}
      </div>
    </footer>
  );
}
