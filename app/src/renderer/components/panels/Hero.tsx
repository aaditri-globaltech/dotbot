/** Centered empty state: faint watermark, serif headline, and a muted hint. */

/** Inputs for a page-level empty state. */
type HeroProps = {
  title: string;
  hint: string;
};

/** Render the shared empty-state headline used by the dashboard and the agent view. */
export function Hero(props: HeroProps) {
  return (
    <div class="grid min-h-0 flex-1 place-items-center overflow-hidden px-6 py-8 text-center">
      <div class="flex max-w-[520px] flex-col items-center gap-4">
        <span
          class="codicon codicon-hubot text-[112px] text-strongForeground/[0.05]"
          decorative="true"
        />
        <h2 class="font-serif text-hero leading-snug text-foreground">
          {props.title}
        </h2>
        <p class="text-body leading-normal text-descriptionForeground">
          {props.hint}
        </p>
      </div>
    </div>
  );
}
