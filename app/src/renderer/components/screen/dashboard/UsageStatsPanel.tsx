/**
 * Usage statistics panel for the dashboard, backed by the main process's
 * reduced session data.
 */

import {
  createMemo,
  createSignal,
  For,
  Index,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import {
  RANGE_DAYS,
  type UsageModelUsage,
  type UsageRangeKey,
  type UsageStats,
  type UsageStatsDay,
} from "../../../../shared/usage-stats";
import { api } from "../../../api";
import { intensityClass } from "./heatmap-intensity";

type Tab = "overview" | "models";

const RANGE_LABELS: { key: UsageRangeKey; label: string }[] = [
  { key: "365", label: "1y" },
  { key: "180", label: "6mo" },
  { key: "90", label: "3mo" },
  { key: "30", label: "30d" },
  { key: "7", label: "7d" },
];

const MAX_BARS = 26; // token chart resolution cap
const CHART_TICKS = 4; // y-axis intervals (-> 5 labels)

/** Categorical palette shared by the stacked bars and the legend. */
const MODEL_COLORS = [
  "bg-[#3fb950]",
  "bg-[#3794ff]",
  "bg-[#38bdf8]",
  "bg-[#a371f7]",
  "bg-[#d29922]",
  "bg-[#f85149]",
  "bg-[#2dd4bf]",
  "bg-[#8b949e]",
];

const TAB_CLASS =
  "cursor-pointer rounded-full px-2.5 py-1 text-meta font-medium";

/** Compact token and message counts: 6600000 -> "6.6M", 847 -> "847". */
function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

/** 23 -> "11 PM", 0 -> "12 AM". */
function formatHour(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${period}`;
}

function formatShortDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface TokenBucket {
  label: string;
  total: number;
  byModel: Record<string, number>;
}

/** Bucket a day slice into at most `MAX_BARS` bars, trimming leading quiet days. */
function bucketTokens(days: UsageStatsDay[]): TokenBucket[] {
  const firstActive = days.findIndex((day) => day.tokens !== 0);
  const span = firstActive === -1 ? [] : days.slice(firstActive);
  if (span.length === 0) return [];

  const size = Math.max(1, Math.ceil(span.length / MAX_BARS));
  const buckets: TokenBucket[] = [];

  for (let i = 0; i < span.length; i += size) {
    const chunk = span.slice(i, i + size);
    const byModel: Record<string, number> = {};
    let total = 0;

    for (const day of chunk) {
      total += day.tokens;
      for (const [model, tokens] of Object.entries(day.tokensByModel)) {
        byModel[model] = (byModel[model] ?? 0) + tokens;
      }
    }

    buckets.push({ label: formatShortDate(chunk[0].date), total, byModel });
  }

  return buckets;
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div class="min-w-0 rounded-lg border border-widget-border bg-editor-background px-3 py-2.5">
      <div class="text-meta text-descriptionForeground">{props.label}</div>
      <div
        class="mt-0.5 truncate text-display font-semibold text-strongForeground"
        title={props.value}
      >
        {props.value}
      </div>
    </div>
  );
}

/**
 * Message counts per day, laid out as week columns: the grid flows down seven
 * weekday rows first, and `grid-row-start` puts each day on its own weekday.
 */
function Heatmap(props: { days: UsageStatsDay[] }) {
  const maxCount = createMemo(() =>
    props.days.reduce((max, day) => Math.max(max, day.messages), 0),
  );

  return (
    <div class="grid auto-cols-[12px] grid-flow-col grid-rows-[repeat(7,12px)] gap-1 overflow-x-auto pb-1">
      <For each={props.days}>
        {(day) => (
          <div
            title={`${day.date}: ${day.messages} messages`}
            class={`rounded-sm ${intensityClass(day.messages, maxCount())}`}
            style={{
              "grid-row-start": new Date(`${day.date}T00:00:00`).getDay() + 1,
            }}
          />
        )}
      </For>
    </div>
  );
}

/** Stacked token bars, one column per bucket, coloured by model. */
function TokenChart(props: {
  days: UsageStatsDay[];
  /** Largest first, also the stacking order. */
  orderedModels: string[];
  modelColor: Map<string, string>;
}) {
  const buckets = createMemo(() => bucketTokens(props.days));
  const max = createMemo(() =>
    buckets().reduce((top, bucket) => Math.max(top, bucket.total), 0),
  );
  const ticks = createMemo(() =>
    Array.from(
      { length: CHART_TICKS + 1 },
      (_, index) => (max() * (CHART_TICKS - index)) / CHART_TICKS,
    ),
  );
  const labelStep = createMemo(() => Math.ceil(buckets().length / 6));

  return (
    <Show
      when={buckets().length > 0}
      fallback={
        <p class="py-6 text-center text-body text-descriptionForeground">
          No token usage in this range.
        </p>
      }
    >
      <div class="flex gap-2">
        <div class="flex h-40 shrink-0 basis-[46px] flex-col justify-between text-right text-meta text-disabledForeground tabular-nums">
          <Index each={ticks()}>
            {(tick) => <span>{formatCompact(Math.round(tick()))}</span>}
          </Index>
        </div>

        <div class="min-w-0 flex-1">
          <div class="relative h-40">
            <Index each={ticks()}>
              {(_, index) => (
                <div
                  class="absolute inset-x-0 border-t border-widget-border"
                  style={{ top: `${(index / CHART_TICKS) * 100}%` }}
                />
              )}
            </Index>

            <div class="absolute inset-0 flex items-end gap-0.5">
              <For each={buckets()}>
                {(bucket) => (
                  <div
                    class="flex min-w-[2px] flex-1 flex-col overflow-hidden rounded-sm"
                    title={`${bucket.label}: ${formatCompact(bucket.total)} tokens`}
                    style={{
                      height:
                        max() > 0
                          ? `${Math.max((bucket.total / max()) * 100, bucket.total > 0 ? 2 : 0)}%`
                          : "0%",
                    }}
                  >
                    <For each={props.orderedModels}>
                      {(model) => {
                        const tokens = bucket.byModel[model] ?? 0;
                        return (
                          <Show when={tokens > 0}>
                            <div
                              class={`w-full shrink-0 ${props.modelColor.get(model)}`}
                              style={{
                                height: `${(tokens / bucket.total) * 100}%`,
                              }}
                            />
                          </Show>
                        );
                      }}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </div>

          <div class="mt-1 flex gap-1 text-meta text-disabledForeground">
            <Index each={buckets()}>
              {(bucket, index) => (
                <div class="min-w-[2px] flex-1 text-center">
                  {index % labelStep() === 0 ? bucket().label : ""}
                </div>
              )}
            </Index>
          </div>
        </div>
      </div>
    </Show>
  );
}

/** Token totals per model, largest first, sharing the chart's colours. */
function ModelLegend(props: {
  models: UsageModelUsage[];
  modelColor: Map<string, string>;
}) {
  const grandTotal = createMemo(() =>
    props.models.reduce((sum, model) => sum + model.input + model.output, 0),
  );

  return (
    <Show
      when={props.models.length > 0}
      fallback={
        <p class="py-6 text-center text-body text-descriptionForeground">
          No model usage in this range.
        </p>
      }
    >
      <div class="mt-4 flex flex-col gap-1.5 border-t border-widget-border pt-3">
        <For each={props.models}>
          {(model) => {
            const total = () => model.input + model.output;
            const percent = () =>
              grandTotal() > 0 ? (total() / grandTotal()) * 100 : 0;
            return (
              <div class="flex items-center gap-2 text-meta">
                <span
                  class={`size-2 shrink-0 rounded-full ${props.modelColor.get(model.model)}`}
                />
                <span class="min-w-0 flex-1 truncate text-foreground">
                  {model.model}
                </span>
                <span class="shrink-0 text-descriptionForeground tabular-nums">
                  {formatCompact(model.input)} in ·{" "}
                  {formatCompact(model.output)} out
                </span>
                <span class="w-[46px] shrink-0 text-right text-disabledForeground tabular-nums">
                  {percent().toFixed(1)}%
                </span>
              </div>
            );
          }}
        </For>
      </div>
    </Show>
  );
}

/** One statistics snapshot: range and tab selection with the panels below. */
function UsageSection(props: { stats: UsageStats }) {
  const [tab, setTab] = createSignal<Tab>("overview");
  const [range, setRange] = createSignal<UsageRangeKey>("365");
  const rangedDays = createMemo(() =>
    props.stats.days.slice(-RANGE_DAYS[range()]),
  );
  const summary = () => props.stats.ranges[range()];
  const favoriteModel = () => summary().models[0]?.model ?? "—";
  const peakHourLabel = () => {
    const hour = summary().peakHour;
    return hour === null ? "—" : formatHour(hour);
  };
  const orderedModels = () => summary().models.map((model) => model.model);
  const modelColor = () =>
    new Map<string, string>(
      orderedModels().map((model, index) => [
        model,
        MODEL_COLORS[index % MODEL_COLORS.length],
      ]),
    );

  return (
    <section class="mb-6 rounded-xl border border-widget-border bg-editorWidget-background p-4">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div class="flex gap-0.5">
          <For each={["overview", "models"] as Tab[]}>
            {(name) => (
              <button
                type="button"
                pressed={String(tab() === name)}
                class={`${TAB_CLASS} ${
                  tab() === name
                    ? "bg-inputOption-activeBackground text-strongForeground"
                    : "bg-transparent text-descriptionForeground hover:bg-list-hoverBackground hover:text-strongForeground"
                }`}
                onClick={() => setTab(name)}
              >
                {name === "overview" ? "Overview" : "Models"}
              </button>
            )}
          </For>
        </div>

        <div class="flex gap-0.5 rounded-full bg-editor-background p-0.5">
          <For each={RANGE_LABELS}>
            {({ key, label }) => (
              <button
                type="button"
                pressed={String(range() === key)}
                class={`${TAB_CLASS} ${
                  range() === key
                    ? "bg-inputOption-activeBackground text-strongForeground"
                    : "bg-transparent text-descriptionForeground hover:bg-list-hoverBackground hover:text-strongForeground"
                }`}
                onClick={() => setRange(key)}
              >
                {label}
              </button>
            )}
          </For>
        </div>
      </div>

      <Show
        when={tab() === "overview"}
        fallback={
          <>
            <TokenChart
              days={rangedDays()}
              orderedModels={orderedModels()}
              modelColor={modelColor()}
            />
            <ModelLegend models={summary().models} modelColor={modelColor()} />
          </>
        }
      >
        <div class="mb-4 grid grid-cols-4 gap-2">
          <StatCard
            label="Sessions"
            value={summary().sessions.toLocaleString()}
          />
          <StatCard
            label="Messages"
            value={summary().messages.toLocaleString()}
          />
          <StatCard
            label="Total tokens"
            value={formatCompact(summary().totalTokens)}
          />
          <StatCard
            label="Active days"
            value={summary().activeDays.toLocaleString()}
          />
          <StatCard
            label="Current streak"
            value={`${summary().currentStreak}d`}
          />
          <StatCard
            label="Longest streak"
            value={`${summary().longestStreak}d`}
          />
          <StatCard label="Peak hour" value={peakHourLabel()} />
          <StatCard label="Favorite model" value={favoriteModel()} />
        </div>

        <Heatmap days={rangedDays()} />
      </Show>
    </section>
  );
}

/**
 * Usage overview for the loaded statistics. Renders nothing until there is
 * activity, so a fresh install shows only the launcher.
 */
export function UsageStatsPanel() {
  const [stats, setStats] = createSignal<UsageStats | null>(null);
  const [failed, setFailed] = createSignal(false);

  onMount(() => {
    let cancelled = false;
    api.stats
      .get()
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) setFailed(true);
      });
    onCleanup(() => {
      cancelled = true;
    });
  });

  return (
    <Show
      when={!failed()}
      fallback={
        <p class="text-descriptionForeground">
          Usage statistics are unavailable.
        </p>
      }
    >
      <Show when={stats()}>
        {(loaded) => (
          <Show when={loaded().ranges["365"].messages !== 0}>
            <UsageSection stats={loaded()} />
          </Show>
        )}
      </Show>
    </Show>
  );
}
