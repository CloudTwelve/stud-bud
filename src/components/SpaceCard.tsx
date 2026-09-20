import Link from "next/link";
import type { ScoredSpace } from "@/lib/types";
import { METRIC_ICON } from "./Icons";
import Sparkline from "./Sparkline";

// Teal means "go", orange means "think twice": the score walks between them
// rather than cycling through unrelated hues.
function scoreTone(score: number): { label: string; bar: string; chip: string } {
  if (score >= 80)
    return {
      label: "text-[color:var(--brand)]",
      bar: "from-[var(--brand)] to-[var(--brand-soft)]",
      chip: "bg-[var(--brand)]/15 text-[color:var(--brand)]",
    };
  if (score >= 60)
    return {
      label: "text-[color:var(--brand)]",
      bar: "from-[var(--brand)] to-[var(--accent-soft)]",
      chip: "bg-[var(--brand)]/12 text-[color:var(--brand)]",
    };
  if (score >= 40)
    return {
      label: "text-[color:var(--accent)]",
      bar: "from-[var(--accent-soft)] to-[var(--accent)]",
      chip: "bg-[var(--accent)]/15 text-[color:var(--accent)]",
    };
  return {
    label: "text-rose-600 dark:text-rose-400",
    bar: "from-[var(--accent)] to-rose-500",
    chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  };
}

export function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(minutes)) return "unknown";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} h ago`;
}

export default function SpaceCard({ space }: { space: ScoredSpace }) {
  const tone = scoreTone(space.verdict.score);
  const free = Math.max(0, space.latest.totalSeats - space.latest.occupiedSeats);
  const soundHistory = space.history.map((reading) => reading.sound);

  return (
    <article
      className={`panel flex flex-col gap-5 p-5 transition hover:-translate-y-1 hover:border-line-strong sm:p-6 ${
        space.stale ? "opacity-60 saturate-50" : ""
      }`}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            <Link href={`/space/${space.id}`} className="hover:underline">
              {space.name}
            </Link>
          </h2>
          <p className="text-sm opacity-60">
            {space.building} · {space.stale ? "last seen" : "updated"}{" "}
            {timeAgo(space.latest.recordedAt)}
          </p>
        </div>
        <span
          className={`clip-tag px-3 py-1 text-xs font-semibold whitespace-nowrap ${
            space.stale
              ? "bg-black/10 text-current dark:bg-white/10"
              : tone.chip
          }`}
        >
          {space.stale ? "Stale" : `${free} free`}
        </span>
      </header>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p
            className={`text-5xl font-bold tabular-nums ${space.stale ? "opacity-40" : tone.label}`}
          >
            {space.stale ? "—" : space.verdict.score}
          </p>
          <p className="text-sm font-medium">
            {space.stale ? "No recent sweep" : space.verdict.headline}
          </p>
        </div>
        <div className="w-28">
          <Sparkline
            values={soundHistory}
            gradientId={`spark-${space.id}`}
            from="var(--brand)"
            to="var(--accent)"
          />
          <p className="mt-1 text-right text-[11px] uppercase tracking-wide opacity-50">
            noise trend
          </p>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden bg-black/10 dark:bg-white/10">
        <div
          className={`h-full bg-gradient-to-r ${tone.bar} transition-[width] duration-700`}
          style={{ width: `${space.stale ? 0 : space.verdict.score}%` }}
        />
      </div>

      <p className="text-sm opacity-80">
        {space.stale
          ? `The dog hasn't swept this room since ${timeAgo(space.latest.recordedAt)} — these numbers are probably wrong.`
          : space.verdict.summary}
      </p>

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {space.verdict.metrics.map((metric) => {
          const Icon = METRIC_ICON[metric.metric];
          return (
          <div
            key={metric.metric}
            className="clip-tag bg-[var(--surface-muted)] p-3"
            title={metric.comment}
          >
            <dt className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-60">
              <Icon className="h-3.5 w-3.5 text-brand" />
              {metric.label}
            </dt>
            <dd className="mt-1 flex items-center justify-between gap-3">
              <span className="text-base font-semibold tabular-nums">
                {metric.value}
              </span>
              <span className="h-1.5 w-16 overflow-hidden bg-black/10 dark:bg-white/10">
                <span
                  className={`block h-full bg-gradient-to-r ${scoreTone(metric.score).bar}`}
                  style={{ width: `${metric.score}%` }}
                />
              </span>
            </dd>
            <p className="mt-1 text-xs opacity-70">{metric.comment}</p>
          </div>
          );
        })}
      </dl>
    </article>
  );
}
