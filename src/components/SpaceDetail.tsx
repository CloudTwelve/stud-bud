"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { HourlyPoint, ScoredSpace } from "@/lib/types";
import { ArrowIcon } from "./Icons";
import SpaceCard, { timeAgo } from "./SpaceCard";
import ThemeToggle from "./ThemeToggle";
import TrendChart from "./TrendChart";

interface DetailPayload {
  space: ScoredSpace;
  hourly: HourlyPoint[];
  bestHour: { hour: number; sound: number } | null;
}

function formatHour(hour: number): string {
  const suffix = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${suffix}`;
}

export default function SpaceDetail({ initial }: { initial: DetailPayload }) {
  const [data, setData] = useState(initial);
  const id = initial.space.id;

  const load = useCallback(async () => {
    const response = await fetch(`/api/spaces/${id}`, { cache: "no-store" });
    if (!response.ok) return;
    setData((await response.json()) as DetailPayload);
  }, [id]);

  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.addEventListener("reading", (event) => {
      if ((event as MessageEvent<string>).data === id) void load();
    });
    return () => source.close();
  }, [id, load]);

  const { space, hourly, bestHour } = data;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8 sm:py-14">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/rooms"
            className="flex items-center gap-2 text-sm opacity-60 hover:opacity-100"
          >
            <ArrowIcon className="h-4 w-4 rotate-180 text-accent" />
            All rooms
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">
            {space.name}
          </h1>
          <p className="mt-1 text-sm opacity-70">
            {space.building} · last sweep {timeAgo(space.latest.recordedAt)}
          </p>
        </div>
        <ThemeToggle />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <SpaceCard space={space} />

        <section className="panel flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <p className="eyebrow">History</p>
            <h2 className="mt-2 text-lg font-semibold">Last 24 hours</h2>
            <p className="text-sm opacity-70">
              {bestHour
                ? `Quietest around ${formatHour(bestHour.hour)} — about ${Math.round(bestHour.sound)} dB. Go then if you can pick your time.`
                : "Not enough history yet to spot a quiet hour."}
            </p>
          </div>
          <TrendChart points={hourly} />
        </section>
      </div>

      <section className="panel p-5 text-sm sm:p-6">
        <h2 className="text-lg font-semibold">Recent sweeps</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide opacity-60">
              <tr>
                <th className="py-2 pr-4 font-medium">Time</th>
                <th className="py-2 pr-4 font-medium">Temp</th>
                <th className="py-2 pr-4 font-medium">Humidity</th>
                <th className="py-2 pr-4 font-medium">Noise</th>
                <th className="py-2 pr-4 font-medium">Light</th>
                <th className="py-2 font-medium">Seats free</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...space.history]
                .reverse()
                .slice(0, 12)
                .map((reading) => (
                  <tr key={reading.recordedAt} className="border-t border-line">
                    <td className="py-2 pr-4">
                      {new Date(reading.recordedAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2 pr-4">{reading.temperature.toFixed(1)}°C</td>
                    <td className="py-2 pr-4">{Math.round(reading.humidity)}%</td>
                    <td className="py-2 pr-4">{Math.round(reading.sound)} dB</td>
                    <td className="py-2 pr-4">{Math.round(reading.light)} lux</td>
                    <td className="py-2">
                      {Math.max(0, reading.totalSeats - reading.occupiedSeats)} /{" "}
                      {reading.totalSeats}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
