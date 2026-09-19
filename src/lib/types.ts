export type Metric =
  | "temperature"
  | "humidity"
  | "sound"
  | "light"
  | "occupancy";

export interface Reading {
  spaceId: string;
  /** Celsius */
  temperature: number;
  /** Relative humidity, percent */
  humidity: number;
  /** Decibels */
  sound: number;
  /** Lux */
  light: number;
  /** Seats currently taken */
  occupiedSeats: number;
  /** Total seats the robot dog counted in the room */
  totalSeats: number;
  /** ISO timestamp */
  recordedAt: string;
}

export interface Space {
  id: string;
  name: string;
  building: string;
  latest: Reading;
  history: Reading[];
  /** No sweep recently, so the readings can't be trusted. */
  stale: boolean;
}

export interface HourlyPoint {
  /** ISO timestamp of the start of the hour */
  hour: string;
  temperature: number;
  humidity: number;
  sound: number;
  light: number;
  /** Fraction of seats taken, 0-1 */
  fullness: number;
  samples: number;
}

export interface MetricVerdict {
  metric: Metric;
  label: string;
  value: string;
  score: number;
  comment: string;
}

export interface SpaceVerdict {
  score: number;
  headline: string;
  summary: string;
  metrics: MetricVerdict[];
}

export interface ScoredSpace extends Space {
  verdict: SpaceVerdict;
}
