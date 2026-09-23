/** Centered empty state: faint watermark, serif headline, and a muted hint. */

/** Inputs for a page-level empty state. */
type HeroProps = {
  title: string;
  hint: string;
};

/** Render the shared empty-state headline used by the dashboard and the agent view. */
export function Hero(props: HeroProps) {
  return (
    <div class="grid flex-1 place-items-center px-6 py-10 text-center">
      <div class="flex max-w-[520px] flex-col items-center gap-4">
        <span
          class="codicon codicon-hubot text-[112px] text-primary/[0.05]"
          decorative="true"
        />
        <h2 class="font-serif text-[32px] leading-snug text-secondary">
          {props.title}
        </h2>
        <p class="text-[13px] leading-normal text-dim">{props.hint}</p>
      </div>
    </div>
  );
}
