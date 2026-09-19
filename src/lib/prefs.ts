"use client";

import { DEFAULT_WEIGHTS, type Weights } from "./score";
import type { Metric } from "./types";

const KEY = "studbud-weights";
const METRICS: Metric[] = [
  "temperature",
  "humidity",
  "sound",
  "light",
  "occupancy",
];

const listeners = new Set<() => void>();
let cached: Weights | null = null;

function parse(raw: string | null): Weights {
  if (!raw) return DEFAULT_WEIGHTS;
  try {
    const value = JSON.parse(raw) as Partial<Record<Metric, unknown>>;
    const weights = { ...DEFAULT_WEIGHTS };
    for (const metric of METRICS) {
      const candidate = value[metric];
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        weights[metric] = Math.max(0, Math.min(4, candidate));
      }
    }
    return weights;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export function subscribeWeights(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWeights(): Weights {
  if (!cached) {
    cached =
      typeof window === "undefined"
        ? DEFAULT_WEIGHTS
        : parse(window.localStorage.getItem(KEY));
  }
  return cached;
}

export function getServerWeights(): Weights {
  return DEFAULT_WEIGHTS;
}

export function setWeights(weights: Weights): void {
  cached = weights;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(weights));
  } catch {
    // storage unavailable; keep the in-memory value
  }
  for (const listener of listeners) listener();
}

export function resetWeights(): void {
  setWeights(DEFAULT_WEIGHTS);
}
