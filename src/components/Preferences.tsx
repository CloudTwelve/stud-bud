"use client";

import type { Weights } from "@/lib/score";
import { PRESETS } from "@/lib/score";
import type { Metric } from "@/lib/types";
import { METRIC_ICON } from "./Icons";

const FACTORS: { metric: Metric; label: string; hint: string }[] = [
  { metric: "sound", label: "Quiet", hint: "Low noise" },
  { metric: "occupancy", label: "Free seats", hint: "Somewhere to sit" },
  { metric: "temperature", label: "Temperature", hint: "Not too hot or cold" },
  { metric: "light", label: "Light", hint: "Bright enough to read" },
  { metric: "humidity", label: "Fresh air", hint: "Not stuffy" },
];

const IMPORTANCE = ["Ignore", "Minor", "Nice", "Important", "Critical"];

interface PreferencesProps {
  weights: Weights;
  onChange: (weights: Weights) => void;
  onReset: () => void;
}

export default function Preferences({ weights, onChange, onReset }: PreferencesProps) {
  const ranked = [...FACTORS].sort(
    (a, b) => weights[b.metric] - weights[a.metric],
  );

  return (
    <section className="panel rise flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Your study preferences</h2>
          <p className="text-sm opacity-70">
            Slide what matters to you; the Personalized ranking rescores every room.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1.5 text-xs font-medium underline decoration-[var(--accent)] decoration-2 underline-offset-4 opacity-70 hover:opacity-100"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.weights)}
            className="panel-sm clip-tag px-3 py-1.5 text-xs font-medium transition hover:-translate-y-0.5 hover:border-line-strong"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FACTORS.map((factor) => {
          const value = weights[factor.metric];
          const Icon = METRIC_ICON[factor.metric];
          return (
            <label key={factor.metric} className="flex flex-col gap-1 text-sm">
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <Icon className="h-4 w-4 text-brand" />
                  {factor.label}
                  <span className="text-xs font-normal opacity-50">{factor.hint}</span>
                </span>
                <span className="text-xs uppercase tracking-wide opacity-60">
                  {IMPORTANCE[Math.min(IMPORTANCE.length - 1, Math.round(value))]}
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={4}
                step={0.5}
                value={value}
                onChange={(event) =>
                  onChange({ ...weights, [factor.metric]: Number(event.target.value) })
                }
                className="accent-[var(--accent)]"
                aria-label={`How important is ${factor.label}?`}
              />
            </label>
          );
        })}
      </div>

      <p className="text-xs opacity-60">
        Priority order: {ranked.map((factor) => factor.label).join(" › ")}
      </p>
    </section>
  );
}
