"use client";

import { useId, useState } from "react";
import type { HourlyPoint } from "@/lib/types";

type Series = {
  key: keyof Pick<HourlyPoint, "sound" | "temperature" | "humidity" | "light" | "fullness">;
  label: string;
  unit: string;
  from: string;
  to: string;
  format: (value: number) => string;
};

const SERIES: Series[] = [
  {
    key: "sound",
    label: "Noise",
    unit: "dB",
    from: "var(--brand)",
    to: "var(--accent)",
    format: (v) => `${Math.round(v)} dB`,
  },
  {
    key: "fullness",
    label: "Fullness",
    unit: "%",
    from: "var(--brand-soft)",
    to: "var(--brand)",
    format: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "temperature",
    label: "Temperature",
    unit: "°C",
    from: "var(--accent-soft)",
    to: "var(--accent)",
    format: (v) => `${v.toFixed(1)}°C`,
  },
  {
    key: "humidity",
    label: "Humidity",
    unit: "%",
    from: "var(--brand)",
    to: "var(--brand-soft)",
    format: (v) => `${Math.round(v)}%`,
  },
  {
    key: "light",
    label: "Light",
    unit: "lux",
    from: "var(--accent)",
    to: "var(--brand)",
    format: (v) => `${Math.round(v)} lux`,
  },
];

const WIDTH = 720;
const HEIGHT = 200;
const PADDING = 8;

export default function TrendChart({ points }: { points: HourlyPoint[] }) {
  const [active, setActive] = useState<Series>(SERIES[0]);
  const gradientId = useId();

  if (points.length < 2) {
    return (
      <p className="text-sm opacity-60">
        Not enough history yet — the chart appears after a couple of sweeps.
      </p>
    );
  }

  const values = points.map((point) => point[active.key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (WIDTH - PADDING * 2) / (points.length - 1);

  const coords = values.map((value, index) => {
    const x = PADDING + index * stepX;
    const y = PADDING + (1 - (value - min) / span) * (HEIGHT - PADDING * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `${PADDING},${HEIGHT - PADDING} ${coords.join(" ")} ${
    WIDTH - PADDING
  },${HEIGHT - PADDING}`;

  const hourLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "numeric" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {SERIES.map((series) => (
          <button
            key={series.key}
            type="button"
            onClick={() => setActive(series)}
            aria-pressed={series.key === active.key}
            className={`clip-tag px-3 py-1.5 text-xs font-medium transition ${
              series.key === active.key
                ? "on-accent"
                : "panel-sm hover:-translate-y-0.5 hover:border-line-strong"
            }`}
          >
            {series.label}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-48 w-full"
        role="img"
        aria-label={`${active.label} over the last 24 hours`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={active.from} />
            <stop offset="100%" stopColor={active.to} />
          </linearGradient>
          <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={active.to} stopOpacity="0.35" />
            <stop offset="100%" stopColor={active.to} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((step) => (
          <line
            key={step}
            x1={PADDING}
            x2={WIDTH - PADDING}
            y1={PADDING + (step / 4) * (HEIGHT - PADDING * 2)}
            y2={PADDING + (step / 4) * (HEIGHT - PADDING * 2)}
            stroke="var(--line)"
            strokeWidth="1"
          />
        ))}
        <polygon points={area} fill={`url(#${gradientId}-fill)`} />
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="3"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>

      <div className="flex justify-between text-xs opacity-60">
        <span>{hourLabel(points[0].hour)}</span>
        <span>
          {active.label}: {active.format(min)} – {active.format(max)}
        </span>
        <span>{hourLabel(points[points.length - 1].hour)}</span>
      </div>
    </div>
  );
}
