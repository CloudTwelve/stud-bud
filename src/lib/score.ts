import type { MetricVerdict, Reading, SpaceVerdict } from "./types";

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

function comment(score: number, good: string, ok: string, bad: string): string {
  if (score >= 80) return good;
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

const WEIGHTS: Record<string, number> = {
  temperature: 1,
  humidity: 0.7,
  sound: 1.4,
  light: 1,
  occupancy: 1.5,
};

export function evaluate(reading: Reading): SpaceVerdict {
  const temperature = band(reading.temperature, 12, 19, 23.5, 32);
  const humidity = band(reading.humidity, 10, 30, 55, 85);
  const sound = band(reading.sound, -20, 0, 45, 80);
  const light = band(reading.light, 20, 300, 800, 2000);
  const free = freeSeats(reading);
  const occupancy = Math.round(
    100 * Math.min(1, free / Math.max(1, reading.totalSeats * 0.25)),
  );

  const metrics: MetricVerdict[] = [
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

  const totalWeight = metrics.reduce((sum, m) => sum + WEIGHTS[m.metric], 0);
  const score = Math.round(
    metrics.reduce((sum, m) => sum + m.score * WEIGHTS[m.metric], 0) / totalWeight,
  );

  const weakest = [...metrics].sort((a, b) => a.score - b.score)[0];
  const headline =
    score >= 80
      ? "Great place to study"
      : score >= 60
        ? "Decent — with caveats"
        : score >= 40
          ? "Only if you have to"
          : "Study somewhere else";
  const summary =
    score >= 80
      ? `Conditions are in a good range across the board and ${free} seats are open.`
      : `${weakest.label.toLowerCase()} is the weak spot: ${weakest.comment.toLowerCase()}`;

  return { score, headline, summary, metrics };
}
