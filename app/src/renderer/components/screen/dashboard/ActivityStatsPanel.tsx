/**
 * Activity statistics panel for the dashboard, backed by the main process's
 * reduced session data.
 */

import { useEffect, useMemo, useState } from "react";
import {
  type ActivityModelUsage,
  type ActivityRangeKey,
  type ActivityStatsDay,
  type ActivityStatsResult,
  RANGE_DAYS,
} from "../../../../shared/activity-stats";
import { api } from "../../../api";
import { intensityClass } from "./heatmap-intensity";

type Tab = "overview" | "models";

const RANGE_LABELS: { key: ActivityRangeKey; label: string }[] = [
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

const TAB_CLASS = "cursor-pointer rounded px-2.5 py-1 text-xs font-medium";

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
function bucketTokens(days: ActivityStatsDay[]): TokenBucket[] {
  let start = 0;
  while (start < days.length && days[start].tokens === 0) start += 1;

  const span = days.slice(start);
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-card px-3 py-2.5">
      <div className="text-[11px] tracking-[0.04em] text-muted uppercase">
        {label}
      </div>
      <div
        className="mt-0.5 truncate text-lg font-semibold text-primary"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Message counts per day, laid out as week columns: the grid flows down seven
 * weekday rows first, and `gridRowStart` puts each day on its own weekday.
 */
function Heatmap({ days }: { days: ActivityStatsDay[] }) {
  const maxCount = useMemo(
    () => days.reduce((max, day) => Math.max(max, day.messages), 0),
    [days],
  );

  return (
    <div className="grid auto-cols-[12px] grid-flow-col grid-rows-[repeat(7,12px)] gap-1 overflow-x-auto pb-1">
      {days.map((day) => (
        <div
          key={day.date}
          title={`${day.date}: ${day.messages} messages`}
          className={`rounded-sm ${intensityClass(day.messages, maxCount)}`}
          style={{
            gridRowStart: new Date(`${day.date}T00:00:00`).getDay() + 1,
          }}
        />
      ))}
    </div>
  );
}

/** Stacked token bars, one column per bucket, coloured by model. */
function TokenChart({
  days,
  orderedModels,
  modelColor,
}: {
  days: ActivityStatsDay[];
  /** Largest first, also the stacking order. */
  orderedModels: string[];
  modelColor: Map<string, string>;
}) {
  const buckets = useMemo(() => bucketTokens(days), [days]);

  if (buckets.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted">
        No token usage in this range.
      </p>
    );
  }

  const max = buckets.reduce((top, bucket) => Math.max(top, bucket.total), 0);
  const ticks = Array.from(
    { length: CHART_TICKS + 1 },
    (_, index) => (max * (CHART_TICKS - index)) / CHART_TICKS,
  );
  const labelStep = Math.ceil(buckets.length / 6);

  return (
    <div className="flex gap-2">
      <div className="flex h-40 shrink-0 basis-[46px] flex-col justify-between text-right text-[10px] text-faint tabular-nums">
        {ticks.map((tick) => (
          <span key={tick}>{formatCompact(Math.round(tick))}</span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative h-40">
          {ticks.map((tick, index) => (
            <div
              key={tick}
              className="absolute inset-x-0 border-t border-border"
              style={{ top: `${(index / CHART_TICKS) * 100}%` }}
            />
          ))}

          <div className="absolute inset-0 flex items-end gap-[3px]">
            {buckets.map((bucket) => (
              <div
                key={bucket.label}
                className="flex min-w-[2px] flex-1 flex-col overflow-hidden rounded-sm"
                title={`${bucket.label}: ${formatCompact(bucket.total)} tokens`}
                style={{
                  height:
                    max > 0
                      ? `${Math.max((bucket.total / max) * 100, bucket.total > 0 ? 2 : 0)}%`
                      : "0%",
                }}
              >
                {orderedModels.map((model) => {
                  const tokens = bucket.byModel[model] ?? 0;
                  if (tokens <= 0 || bucket.total <= 0) return null;
                  return (
                    <div
                      key={model}
                      className={`w-full shrink-0 ${modelColor.get(model)}`}
                      style={{ height: `${(tokens / bucket.total) * 100}%` }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-1 flex gap-[3px] text-[10px] text-faint">
          {buckets.map((bucket, index) => (
            <div key={bucket.label} className="min-w-[2px] flex-1 text-center">
              {index % labelStep === 0 ? bucket.label : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Token totals per model, largest first, sharing the chart's colours. */
function ModelLegend({
  models,
  modelColor,
}: {
  models: ActivityModelUsage[];
  modelColor: Map<string, string>;
}) {
  const grandTotal = models.reduce(
    (sum, model) => sum + model.input + model.output,
    0,
  );

  if (models.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted">
        No model usage in this range.
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
      {models.map((model) => {
        const total = model.input + model.output;
        const percent = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
        return (
          <div key={model.model} className="flex items-center gap-2 text-xs">
            <span
              className={`size-2 shrink-0 rounded-full ${modelColor.get(model.model)}`}
            />
            <span className="min-w-0 flex-1 truncate text-secondary">
              {model.model}
            </span>
            <span className="shrink-0 text-muted tabular-nums">
              {formatCompact(model.input)} in · {formatCompact(model.output)}{" "}
              out
            </span>
            <span className="w-[46px] shrink-0 text-right text-faint tabular-nums">
              {percent.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Activity overview with a range toggle. Renders nothing until there is
 * activity, so a fresh install shows only the launcher.
 */
export function ActivityStatsPanel() {
  const [stats, setStats] = useState<ActivityStatsResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState<ActivityRangeKey>("365");

  useEffect(() => {
    let cancelled = false;
    api.activity
      .getStats()
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rangedDays = useMemo(() => {
    if (!stats) return [];
    return stats.days.slice(-RANGE_DAYS[range]);
  }, [stats, range]);

  if (failed) {
    return <p className="text-muted">Activity statistics are unavailable.</p>;
  }
  if (!stats || stats.ranges["365"].messages === 0) return null;

  const summary = stats.ranges[range];
  const favoriteModel = summary.models[0]?.model ?? "—";
  const orderedModels = summary.models.map((model) => model.model);
  const modelColor = new Map<string, string>(
    orderedModels.map((model, index) => [
      model,
      MODEL_COLORS[index % MODEL_COLORS.length],
    ]),
  );

  return (
    <section className="mb-6 rounded-lg border border-border bg-card/50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-0.5">
          {(["overview", "models"] as Tab[]).map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={tab === name}
              className={`${TAB_CLASS} ${
                tab === name
                  ? "bg-elevated text-primary"
                  : "bg-transparent text-muted hover:text-primary"
              }`}
              onClick={() => setTab(name)}
            >
              {name === "overview" ? "Overview" : "Models"}
            </button>
          ))}
        </div>

        <div className="flex gap-0.5 rounded bg-card p-0.5">
          {RANGE_LABELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={range === key}
              className={`${TAB_CLASS} ${
                range === key
                  ? "bg-elevated text-primary"
                  : "bg-transparent text-muted hover:text-primary"
              }`}
              onClick={() => setRange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? (
        <>
          <div className="mb-4 grid grid-cols-4 gap-2">
            <StatCard
              label="Sessions"
              value={summary.sessions.toLocaleString()}
            />
            <StatCard
              label="Messages"
              value={summary.messages.toLocaleString()}
            />
            <StatCard
              label="Total tokens"
              value={formatCompact(summary.totalTokens)}
            />
            <StatCard
              label="Active days"
              value={summary.activeDays.toLocaleString()}
            />
            <StatCard
              label="Current streak"
              value={`${summary.currentStreak}d`}
            />
            <StatCard
              label="Longest streak"
              value={`${summary.longestStreak}d`}
            />
            <StatCard
              label="Peak hour"
              value={
                summary.peakHour === null ? "—" : formatHour(summary.peakHour)
              }
            />
            <StatCard label="Favorite model" value={favoriteModel} />
          </div>

          <Heatmap days={rangedDays} />
        </>
      ) : (
        <>
          <TokenChart
            days={rangedDays}
            orderedModels={orderedModels}
            modelColor={modelColor}
          />
          <ModelLegend models={summary.models} modelColor={modelColor} />
        </>
      )}
    </section>
  );
}
