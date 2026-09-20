"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useReorderAnimation } from "@/lib/motion";
import {
  getServerWeights,
  getWeights,
  resetWeights,
  setWeights,
  subscribeWeights,
} from "@/lib/prefs";
import { DEFAULT_WEIGHTS, evaluate } from "@/lib/score";
import type { ScoredSpace, Space } from "@/lib/types";
import CampusMap from "./CampusMap";
import { ArrowIcon, BookIcon, DogIcon, GridIcon, MapIcon, SignalIcon } from "./Icons";
import LiteToggle from "./LiteToggle";
import Logo from "./Logo";
import Preferences from "./Preferences";
import Quip from "./Quip";
import SpaceCard from "./SpaceCard";
import ThemeToggle from "./ThemeToggle";

type SortKey = "score" | "personalized" | "quiet" | "free";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Best overall" },
  { key: "personalized", label: "Personalized" },
  { key: "quiet", label: "Quietest" },
  { key: "free", label: "Most free seats" },
];

const POLL_MS = 30000;

interface DashboardProps {
  initialSpaces: Space[];
}

export default function Dashboard({ initialSpaces }: DashboardProps) {
  const [spaces, setSpaces] = useState<Space[]>(initialSpaces);
  const [sort, setSort] = useState<SortKey>("score");
  const [mapView, setMapView] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/readings", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { spaces: Space[]; updatedAt: string };
      setSpaces(data.spaces);
      setUpdatedAt(data.updatedAt);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "failed to load readings");
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.addEventListener("ready", () => setLive(true));
    source.addEventListener("reading", () => void load());
    source.onerror = () => setLive(false);
    return () => source.close();
  }, [load]);

  const personalWeights = useSyncExternalStore(
    subscribeWeights,
    getWeights,
    getServerWeights,
  );
  const personalized = sort === "personalized";
  const weights = personalized ? personalWeights : DEFAULT_WEIGHTS;

  const scored: ScoredSpace[] = useMemo(
    () => spaces.map((space) => ({ ...space, verdict: evaluate(space.latest, weights) })),
    [spaces, weights],
  );

  const sorted = useMemo(() => {
    const copy = [...scored];
    const rank = (space: ScoredSpace) => (space.stale ? -1 : 1);
    if (sort === "quiet") {
      copy.sort((a, b) => rank(b) - rank(a) || a.latest.sound - b.latest.sound);
    } else if (sort === "free") {
      copy.sort(
        (a, b) =>
          rank(b) - rank(a) ||
          b.latest.totalSeats -
            b.latest.occupiedSeats -
            (a.latest.totalSeats - a.latest.occupiedSeats),
      );
    } else {
      copy.sort((a, b) => rank(b) - rank(a) || b.verdict.score - a.verdict.score);
    }
    return copy;
  }, [scored, sort]);

  const best = sorted.find((space) => !space.stale) ?? null;
  const cardRef = useReorderAnimation(sorted.map((space) => space.id));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:gap-10 sm:px-8 sm:py-14">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">
              <DogIcon className="h-4 w-4" />
              HackMIT · Arduino + robot dog
            </p>
            <h1 className="mt-3">
              <Logo className="h-10 sm:h-14" />
            </h1>
            <p className="mt-3 max-w-xl text-sm opacity-75 sm:text-base">
              Live temperature, humidity, noise, light and seat counts from every
              room our sensors roam — scored so you know where to actually study.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="panel-sm clip-tag flex items-center gap-2 px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 hover:border-line-strong"
            >
              <BookIcon className="h-4 w-4 text-brand" />
              How it works
            </Link>
            <Link
              href="/test"
              className="panel-sm clip-tag flex items-center gap-2 px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 hover:border-line-strong"
            >
              <SignalIcon className="h-4 w-4 text-brand" />
              Test bench
            </Link>
            <LiteToggle />
            <ThemeToggle />
          </div>
        </div>

        {best && (
          <Link
            href={`/space/${best.id}`}
            className="panel rise block border-l-2 border-l-[var(--accent)] p-5 transition hover:-translate-y-0.5 hover:border-line-strong sm:p-6"
          >
            <p className="eyebrow">Go here right now</p>
            <p className="mt-2 flex items-center gap-2 text-xl font-semibold sm:text-2xl">
              {best.name}{" "}
              <span className="text-base font-normal opacity-50">{best.building}</span>
              <ArrowIcon className="h-4 w-4 text-accent" />
            </p>
            <p className="mt-1 text-sm opacity-80">{best.verdict.summary}</p>
          </Link>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {SORTS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  setSort(option.key);
                  if (option.key === "personalized") setShowPrefs(true);
                }}
                aria-pressed={sort === option.key}
                className={`clip-tag px-4 py-2 text-sm font-medium transition ${
                  sort === option.key
                    ? "on-accent"
                    : "panel-sm hover:-translate-y-0.5 hover:border-line-strong"
                }`}
              >
                {option.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <div className="panel-sm clip-tag flex items-center">
                {[
                  { map: false, label: "Cards", Icon: GridIcon },
                  { map: true, label: "Map", Icon: MapIcon },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setMapView(option.map)}
                    aria-pressed={mapView === option.map}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition ${
                      mapView === option.map ? "on-accent" : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <option.Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="flex items-center gap-2 text-xs opacity-60">
              <span
                className={`inline-block h-2 w-2 ${
                  error
                    ? "bg-rose-500"
                    : live
                      ? "bg-[var(--brand)]"
                      : "bg-[var(--accent)]"
                }`}
                aria-hidden="true"
              />
              {error
                ? `Offline: ${error}`
                : live
                  ? "Live"
                  : updatedAt
                    ? `Synced ${new Date(updatedAt).toLocaleTimeString()}`
                    : "Polling every 30s"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPrefs((open) => !open)}
              aria-expanded={showPrefs}
              className="panel-sm clip-tag px-3 py-1.5 text-xs font-medium transition hover:-translate-y-0.5 hover:border-line-strong"
            >
              {showPrefs ? "Hide preferences" : "Set your preferences"}
            </button>
            {personalized && (
              <span className="text-xs opacity-60">
                Scores below are weighted by your preferences.
              </span>
            )}
          </div>

          {showPrefs && (
            <Preferences
              weights={personalWeights}
              onChange={(next) => {
                setWeights(next);
                setSort("personalized");
              }}
              onReset={resetWeights}
            />
          )}
        </div>
      </header>

      {mapView ? (
        <CampusMap spaces={sorted} />
      ) : (
        <section className="grid gap-5 md:grid-cols-2 md:gap-6">
          {sorted.map((space) => (
            <SpaceCard key={space.id} space={space} ref={cardRef(space.id)} />
          ))}
          {sorted.length === 0 && (
            <p className="opacity-60">
              Waiting for the first sweep — the dog is probably tooling on
              something else.
            </p>
          )}
        </section>
      )}

      <footer className="panel p-5 text-sm sm:p-6">
        <p className="eyebrow">Ingest</p>
        <p className="mt-2 font-semibold">Feeding data in from the hardware</p>
        <p className="mt-1 opacity-75">
          The Arduino and robot dog POST one JSON payload per sweep (send{" "}
          <code className="font-mono text-xs">Authorization: Bearer $STUDBUD_INGEST_TOKEN</code>{" "}
          when the server has a token configured):
        </p>
        <pre className="clip-tag mt-3 overflow-x-auto bg-[var(--code-bg)] p-4 font-mono text-xs text-[color:var(--brand-soft)]">
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
        <Quip />
      </footer>
    </main>
  );
}
