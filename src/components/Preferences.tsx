"use client";

import type { Weights } from "@/lib/score";
import { PRESETS } from "@/lib/score";
import type { Metric } from "@/lib/types";

const FACTORS: { metric: Metric; label: string; hint: string; icon: string }[] = [
  { metric: "sound", label: "Quiet", hint: "Low noise", icon: "🔊" },
  { metric: "occupancy", label: "Free seats", hint: "Somewhere to sit", icon: "🪑" },
  { metric: "temperature", label: "Temperature", hint: "Not too hot or cold", icon: "🌡️" },
  { metric: "light", label: "Light", hint: "Bright enough to read", icon: "💡" },
  { metric: "humidity", label: "Fresh air", hint: "Not stuffy", icon: "💧" },
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
    <section className="card flex flex-col gap-4 rounded-3xl p-5 sm:p-6">
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
          className="rounded-full px-3 py-1.5 text-xs font-medium underline opacity-70 hover:opacity-100"
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
            className="card rounded-full px-3 py-1.5 text-xs font-medium transition hover:scale-[1.02]"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FACTORS.map((factor) => {
          const value = weights[factor.metric];
          return (
            <label key={factor.metric} className="flex flex-col gap-1 text-sm">
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <span aria-hidden="true">{factor.icon}</span>
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
                className="accent-fuchsia-500"
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
