/** Centered empty state: faint watermark, serif headline, and a muted hint. */

/** Inputs for a page-level empty state. */
type HeroProps = {
  title: string;
  hint: string;
};

/** Render the shared empty-state headline used by the dashboard and the agent view. */
export function Hero(props: HeroProps) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-10 text-center">
      <div className="flex max-w-[520px] flex-col items-center gap-4">
        <span
          className="codicon codicon-hubot text-[112px] text-primary/[0.05]"
          dotbot-hidden="true"
        />
        <h2 className="font-serif text-[32px] leading-snug text-secondary">
          {props.title}
        </h2>
        <p className="text-[13px] leading-normal text-dim">{props.hint}</p>
      </div>
    </div>
  );
}
