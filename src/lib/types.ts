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
