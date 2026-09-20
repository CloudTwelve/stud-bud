import { isMetricStale, measuredAt } from "./freshness";
import type { Metric, MetricVerdict, Reading, SpaceVerdict } from "./types";

/**
 * Scores a value on a 0-100 scale: 100 inside [idealLow, idealHigh], falling
 * off linearly to 0 at the tolerated bounds.
 */
function band(
  value: number,
  hardLow: number,
  idealLow: number,
  idealHigh: number,
  hardHigh: number,
): number {
  if (value >= idealLow && value <= idealHigh) return 100;
  if (value < idealLow) {
    if (value <= hardLow) return 0;
    return Math.round(((value - hardLow) / (idealLow - hardLow)) * 100);
  }
  if (value >= hardHigh) return 0;
  return Math.round(((hardHigh - value) / (hardHigh - idealHigh)) * 100);
}

function minutesAgo(iso: string, now: number): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60000);
  if (!Number.isFinite(minutes)) return "a while";
  if (minutes < 120) return `${minutes} min`;
  return `${Math.round(minutes / 60)} h`;
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function comment(score: number, good: string, ok: string, bad: string): string {
  if (score >= 95) return good;
  if (score >= 50) return ok;
  return bad;
}

export function freeSeats(reading: Reading): number {
  return Math.max(0, reading.totalSeats - reading.occupiedSeats);
}

export function fullness(reading: Reading): number {
  if (reading.totalSeats <= 0) return 0;
  return Math.min(1, reading.occupiedSeats / reading.totalSeats);
}

export type Weights = Record<Metric, number>;

export const PRESETS: { id: string; label: string; weights: Weights }[] = [
  {
    id: "balanced",
    label: "Balanced",
    weights: { temperature: 1, humidity: 0.7, sound: 1.4, light: 1, occupancy: 1.5 },
  },
  {
    id: "silence",
    label: "I need silence",
    weights: { temperature: 0.5, humidity: 0.3, sound: 4, light: 0.6, occupancy: 1.5 },
  },
  {
    id: "seat",
    label: "Just find me a seat",
    weights: { temperature: 0.4, humidity: 0.3, sound: 0.8, light: 0.5, occupancy: 4 },
  },
  {
    id: "comfort",
    label: "Comfort first",
    weights: { temperature: 2.5, humidity: 2, sound: 1, light: 2, occupancy: 1 },
  },
];

export const DEFAULT_WEIGHTS: Weights = PRESETS[0].weights;

export function evaluate(
  reading: Reading,
  requested: Weights = DEFAULT_WEIGHTS,
  now: number = Date.now(),
): SpaceVerdict {
  const weights =
    Object.values(requested).some((weight) => weight > 0) ? requested : DEFAULT_WEIGHTS;

  const temperature = band(reading.temperature, 12, 19, 23.5, 32);
  const humidity = band(reading.humidity, 10, 30, 55, 85);
  const sound = band(reading.sound, -20, 0, 45, 80);
  const light = band(reading.light, 20, 300, 800, 2000);
  const free = freeSeats(reading);
  const occupancy = Math.round(
    100 * Math.min(1, free / Math.max(1, reading.totalSeats * 0.25)),
  );

  const measured: Omit<MetricVerdict, "stale">[] = [
    {
      metric: "temperature",
      label: "Temperature",
      value: `${reading.temperature.toFixed(1)}°C`,
      score: temperature,
      comment: comment(
        temperature,
        "Comfortable all-afternoon temperature.",
        reading.temperature > 23.5 ? "A little warm — sleepy zone." : "A little cool — bring a layer.",
        reading.temperature > 23.5 ? "Too hot to focus for long." : "Cold enough to be distracting.",
      ),
    },
    {
      metric: "humidity",
      label: "Humidity",
      value: `${Math.round(reading.humidity)}%`,
      score: humidity,
      comment: comment(
        humidity,
        "Air feels fresh and dry enough.",
        reading.humidity > 55 ? "Slightly muggy." : "A bit dry — keep water nearby.",
        reading.humidity > 55 ? "Stuffy and humid." : "Very dry air.",
      ),
    },
    {
      metric: "sound",
      label: "Noise",
      value: `${Math.round(reading.sound)} dB`,
      score: sound,
      comment: comment(
        sound,
        "Quiet — good for deep work.",
        "Background chatter you can tune out with headphones.",
        "Loud; expect constant interruptions.",
      ),
    },
    {
      metric: "light",
      label: "Light",
      value: `${Math.round(reading.light)} lux`,
      score: light,
      comment: comment(
        light,
        "Bright and easy on the eyes.",
        reading.light > 800 ? "Glary — pick a seat away from the window." : "Dim; a desk lamp would help.",
        reading.light > 800 ? "Harsh glare." : "Too dark to read comfortably.",
      ),
    },
    {
      metric: "occupancy",
      label: "Free seats",
      value: `${free} of ${reading.totalSeats}`,
      score: occupancy,
      comment: comment(
        occupancy,
        "Plenty of open seats right now.",
        "Filling up — go soon if you want a spot.",
        free === 0 ? "Completely full." : "Nearly full; only scraps left.",
      ),
    },
  ];

  // A sweep carries forward what it didn't measure, so a dead sensor rides
  // along on the healthy ones' timestamp. Its number stays visible, marked,
  // but it stops voting: a stale value is worse than a missing one.
  const metrics: MetricVerdict[] = measured.map((metric) =>
    isMetricStale(reading, metric.metric, now)
      ? {
          ...metric,
          stale: true,
          comment: `No reading for ${minutesAgo(measuredAt(reading, metric.metric), now)} — this sensor has gone quiet, so it isn't counted.`,
        }
      : { ...metric, stale: false },
  );

  const counted = metrics.filter((m) => !m.stale);
  const totalWeight = counted.reduce((sum, m) => sum + weights[m.metric], 0);
  const score =
    totalWeight === 0
      ? 0
      : Math.round(
          counted.reduce((sum, m) => sum + m.score * weights[m.metric], 0) /
            totalWeight,
        );

  const weakest = [...(counted.length > 0 ? counted : metrics)].sort(
    (a, b) => a.score - b.score,
  )[0];
  const quiet = metrics.filter((m) => m.stale);
  const headline =
    score >= 80
      ? "Great place to study"
      : score >= 60
        ? "Decent — with caveats"
        : score >= 40
          ? "Only if you have to"
          : "Study somewhere else";
  const body =
    score >= 80
      ? `Conditions are in a good range across the board and ${free} seats are open.`
      : `${weakest.label.toLowerCase()} is the weak spot: ${weakest.comment.toLowerCase()}`;
  const summary =
    quiet.length === 0
      ? body
      : `${body} Scored without ${list(quiet.map((m) => m.label.toLowerCase()))}: not reporting.`;

  return { score, headline, summary, metrics };
}
