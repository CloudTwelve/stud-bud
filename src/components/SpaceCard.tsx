import type { Metric, Space, SpaceVerdict } from "@/lib/types";
import Sparkline from "./Sparkline";

export interface ScoredSpace extends Space {
  verdict: SpaceVerdict;
}

const METRIC_ICON: Record<Metric, string> = {
  temperature: "🌡️",
  humidity: "💧",
  sound: "🔊",
  light: "💡",
  occupancy: "🪑",
};

function scoreTone(score: number): { label: string; bar: string; chip: string } {
  if (score >= 80)
    return {
      label: "text-emerald-700 dark:text-emerald-300",
      bar: "from-emerald-300 to-teal-400",
      chip: "bg-emerald-200/60 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-200",
    };
  if (score >= 60)
    return {
      label: "text-violet-700 dark:text-violet-300",
      bar: "from-sky-300 to-violet-400",
      chip: "bg-violet-200/60 text-violet-900 dark:bg-violet-400/20 dark:text-violet-200",
    };
  if (score >= 40)
    return {
      label: "text-amber-700 dark:text-amber-300",
      bar: "from-amber-200 to-orange-400",
      chip: "bg-amber-200/60 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200",
    };
  return {
    label: "text-rose-700 dark:text-rose-300",
    bar: "from-rose-300 to-fuchsia-500",
    chip: "bg-rose-200/60 text-rose-900 dark:bg-rose-400/20 dark:text-rose-200",
  };
}

function timeAgo(iso: string): string {
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
    <article className="card flex flex-col gap-5 rounded-3xl p-6 shadow-[0_18px_40px_-28px_rgba(76,29,149,0.6)] transition hover:-translate-y-1 hover:shadow-[0_28px_60px_-30px_rgba(76,29,149,0.7)]">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{space.name}</h2>
          <p className="text-sm opacity-60">
            {space.building} · updated {timeAgo(space.latest.recordedAt)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${tone.chip}`}
        >
          {free} free
        </span>
      </header>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className={`text-5xl font-bold tabular-nums ${tone.label}`}>
            {space.verdict.score}
          </p>
          <p className="text-sm font-medium">{space.verdict.headline}</p>
        </div>
        <div className="w-28">
          <Sparkline
            values={soundHistory}
            gradientId={`spark-${space.id}`}
            from="#f0abfc"
            to="#60a5fa"
          />
          <p className="mt-1 text-right text-[11px] uppercase tracking-wide opacity-50">
            noise trend
          </p>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tone.bar} transition-[width] duration-700`}
          style={{ width: `${space.verdict.score}%` }}
        />
      </div>

      <p className="text-sm opacity-80">{space.verdict.summary}</p>

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {space.verdict.metrics.map((metric) => (
          <div
            key={metric.metric}
            className="rounded-2xl bg-white/45 p-3 dark:bg-white/5"
            title={metric.comment}
          >
            <dt className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-60">
              <span aria-hidden="true">{METRIC_ICON[metric.metric]}</span>
              {metric.label}
            </dt>
            <dd className="mt-1 flex items-center justify-between gap-3">
              <span className="text-base font-semibold tabular-nums">
                {metric.value}
              </span>
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <span
                  className={`block h-full rounded-full bg-gradient-to-r ${scoreTone(metric.score).bar}`}
                  style={{ width: `${metric.score}%` }}
                />
              </span>
            </dd>
            <p className="mt-1 text-xs opacity-70">{metric.comment}</p>
          </div>
        ))}
      </dl>
    </article>
  );
}
