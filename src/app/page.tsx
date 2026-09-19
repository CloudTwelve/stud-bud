"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SpaceCard, { type ScoredSpace } from "@/components/SpaceCard";
import ThemeToggle from "@/components/ThemeToggle";

type SortKey = "score" | "quiet" | "free";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Best overall" },
  { key: "quiet", label: "Quietest" },
  { key: "free", label: "Most free seats" },
];

export default function Home() {
  const [spaces, setSpaces] = useState<ScoredSpace[]>([]);
  const [sort, setSort] = useState<SortKey>("score");
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/readings", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as {
        spaces: ScoredSpace[];
        updatedAt: string;
      };
      setSpaces(data.spaces);
      setUpdatedAt(data.updatedAt);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "failed to load readings");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const sorted = useMemo(() => {
    const copy = [...spaces];
    if (sort === "quiet") {
      copy.sort((a, b) => a.latest.sound - b.latest.sound);
    } else if (sort === "free") {
      copy.sort(
        (a, b) =>
          b.latest.totalSeats -
          b.latest.occupiedSeats -
          (a.latest.totalSeats - a.latest.occupiedSeats),
      );
    } else {
      copy.sort((a, b) => b.verdict.score - a.verdict.score);
    }
    return copy;
  }, [spaces, sort]);

  const best = sorted.length > 0 ? [...spaces].sort((a, b) => b.verdict.score - a.verdict.score)[0] : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] opacity-60">
              HackMIT · Arduino + robot dog
            </p>
            <h1 className="mt-2 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-sky-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl">
              Stud-Bud
            </h1>
            <p className="mt-3 max-w-xl text-base opacity-75">
              Live temperature, humidity, noise, light and seat counts from every
              room our sensors roam — scored so you know where to actually study.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {best && (
          <div className="card rounded-3xl p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] opacity-60">
              Go here right now
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {best.name}{" "}
              <span className="opacity-50 text-base font-normal">
                {best.building}
              </span>
            </p>
            <p className="mt-1 text-sm opacity-80">{best.verdict.summary}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {SORTS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSort(option.key)}
              aria-pressed={sort === option.key}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                sort === option.key
                  ? "bg-gradient-to-r from-fuchsia-400 to-sky-400 text-white shadow"
                  : "card hover:scale-[1.02]"
              }`}
            >
              {option.label}
            </button>
          ))}
          <span className="ml-auto text-xs opacity-60">
            {error
              ? `Offline: ${error}`
              : updatedAt
                ? `Synced ${new Date(updatedAt).toLocaleTimeString()}`
                : "Syncing…"}
          </span>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {sorted.map((space) => (
          <SpaceCard key={space.id} space={space} />
        ))}
        {sorted.length === 0 && !error && (
          <p className="opacity-60">Waiting for the first sensor sweep…</p>
        )}
      </section>

      <footer className="card rounded-3xl p-6 text-sm">
        <p className="font-semibold">Feeding data in from the hardware</p>
        <p className="mt-1 opacity-75">
          The Arduino and robot dog POST one JSON payload per sweep:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-2xl bg-black/80 p-4 font-mono text-xs text-fuchsia-100">
{`POST /api/readings
{
  "spaceId": "hayden-reading-room",
  "name": "Hayden Reading Room",
  "building": "Building 14",
  "temperature": 21.4,
  "humidity": 42,
  "sound": 34,
  "light": 520,
  "occupiedSeats": 28,
  "totalSeats": 60
}`}
        </pre>
      </footer>
    </main>
  );
}
