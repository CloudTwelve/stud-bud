import type { Metric, Reading } from "./types";

export const STALE_AFTER_MINUTES = 45;

export const METRICS: Metric[] = [
  "temperature",
  "humidity",
  "sound",
  "light",
  "occupancy",
];

/**
 * When a metric was last actually measured. A sweep only carries the fields
 * its device measured, so `recordedAt` is the age of the newest number in the
 * row, not of every number in it. Rows written before per-metric timestamps
 * existed fall back to the row's own timestamp.
 */
export function measuredAt(reading: Reading, metric: Metric): string {
  return reading.measuredAt?.[metric] ?? reading.recordedAt;
}

export function ageOf(recordedAt: string, now = Date.now()): number {
  return now - Date.parse(recordedAt);
}

function old(recordedAt: string, now: number): boolean {
  const age = ageOf(recordedAt, now);
  return !Number.isFinite(age) || age > STALE_AFTER_MINUTES * 60 * 1000;
}

/** Nothing at all has been measured recently. */
export function isStale(reading: Reading, now = Date.now()): boolean {
  return old(reading.recordedAt, now);
}

/** One sensor has gone quiet while the rest of the room keeps reporting. */
export function isMetricStale(
  reading: Reading,
  metric: Metric,
  now = Date.now(),
): boolean {
  return old(measuredAt(reading, metric), now);
}
