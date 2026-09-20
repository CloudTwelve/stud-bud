"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Space } from "@/lib/types";
import {
  ArrowIcon,
  DropletIcon,
  LightIcon,
  SoundIcon,
  ThermometerIcon,
} from "./Icons";

const POLL_MS = 15000;
/** Re-render the "last sweep" clock even when nothing new arrives. */
const TICK_MS = 1000;
const SILENT_AFTER_S = 120;
/** Give up on a hung request so the next poll can take over. */
const REQUEST_TIMEOUT_MS = 10000;
/** A reading dated further ahead than this means the board's clock is wrong. */
const SKEW_TOLERANCE_S = 60;

function elapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

const READOUTS = [
  { key: "temperature", label: "Temperature", unit: "°C", digits: 1, icon: ThermometerIcon },
  { key: "humidity", label: "Humidity", unit: "% RH", digits: 0, icon: DropletIcon },
  { key: "sound", label: "Noise", unit: "dB", digits: 0, icon: SoundIcon },
  { key: "light", label: "Light", unit: "lux", digits: 0, icon: LightIcon },
] as const;

export default function LiveFeed({
  preferredId,
  initialSpaces,
}: {
  preferredId: string;
  initialSpaces: Space[];
}) {
  const [spaces, setSpaces] = useState(initialSpaces);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const inFlight = useRef(false);
  const pending = useRef(false);

  // The poll and the stream both ask for a reload, so requests are serialised:
  // a trigger arriving mid-request is coalesced into one follow-up fetch. That
  // keeps responses from landing out of order without ever discarding the only
  // answer a slow server managed to give.
  const load = useCallback(async () => {
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    inFlight.current = true;
    try {
      do {
        pending.current = false;
        try {
          const response = await fetch("/api/readings", {
            cache: "no-store",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = (await response.json()) as { spaces: Space[] };
          setSpaces(data.spaces);
          setError(null);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "failed to reach the server");
        }
      } while (pending.current);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // The stream only says *which* room changed, so a message is a cue to refetch.
  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.addEventListener("ready", () => setConnected(true));
    source.addEventListener("reading", () => void load());
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const space = useMemo(() => {
    if (!spaces.length) return undefined;
    const id = selected ?? preferredId;
    return spaces.find((candidate) => candidate.id === id) ?? spaces[0];
  }, [spaces, selected, preferredId]);

  const seconds =
    space && now !== null
      ? Math.round((now - new Date(space.latest.recordedAt).getTime()) / 1000)
      : null;
  // A board whose clock runs ahead would otherwise look permanently fresh.
  const skewed = seconds !== null && seconds < -SKEW_TOLERANCE_S;
  const silent = seconds !== null && (seconds > SILENT_AFTER_S || skewed);

  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Live from the hardware</h2>
          <p className="mt-1 max-w-xl text-sm opacity-75">
            Whatever the Arduino is actually posting, as it arrives. The board
            sends over WiFi to this server; the page listens to the server. Your
            browser never talks to the board directly — it can&apos;t.
          </p>
        </div>
        <span className="flex items-center gap-2 text-xs font-medium">
          <span
            className={`h-2 w-2 ${connected ? "animate-pulse bg-[var(--brand)]" : "bg-slate-400"}`}
          />
          {connected ? "stream open" : "stream closed"}
        </span>
      </div>

      {error && (
        <p className="clip-tag mt-4 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
          Can&apos;t reach the server ({error}). The board can&apos;t either, then.
        </p>
      )}

      {spaces.length > 0 && (
        <label className="mt-4 flex flex-col gap-1">
          <span className="text-sm font-medium">Watching</span>
          <select
            value={space?.id ?? ""}
            onChange={(event) => setSelected(event.target.value)}
            className="clip-tag border border-line bg-transparent px-4 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            {spaces.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · {candidate.id}
              </option>
            ))}
          </select>
        </label>
      )}

      {spaces.length === 0 && (
        <p className="mt-4 text-sm opacity-70">
          No room has ever reported. Send one from the form above to prove the
          server works, then point the board at it.
        </p>
      )}

      {space && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {READOUTS.map((readout) => (
              <div key={readout.key} className="clip-tag bg-[var(--surface-muted)] p-4">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] opacity-60">
                  <readout.icon className="h-3.5 w-3.5 text-brand" />
                  {readout.label}
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold">
                  {space.latest[readout.key].toFixed(readout.digits)}
                  <span className="ml-1 text-sm font-normal opacity-60">{readout.unit}</span>
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm">
            {/* Rendered from `now`, which is null until the first tick, so the
                server and the first client render agree. */}
            <span className={silent ? "text-[color:var(--accent)]" : "opacity-75"}>
              {seconds === null
                ? "Checking the last sweep…"
                : skewed
                  ? "Last sweep is dated in the future — the board's clock is wrong"
                  : `Last sweep ${elapsed(Math.max(0, seconds))}`}
            </span>
            {space.latest.totalSeats > 0 && (
              <span className="opacity-75">
                {" · "}
                {space.latest.totalSeats - space.latest.occupiedSeats} of{" "}
                {space.latest.totalSeats} seats free
              </span>
            )}{" "}
            <Link
              href={`/space/${space.id}`}
              className="inline-flex items-center gap-1 underline decoration-[var(--accent)] decoration-2 underline-offset-4"
            >
              full history
              <ArrowIcon className="h-3.5 w-3.5 text-accent" />
            </Link>
          </p>

          {silent && (
            <div className="clip-tag mt-4 bg-[var(--accent)]/10 px-4 py-3 text-sm">
              <p className="font-medium text-[color:var(--accent)]">
                {skewed
                  ? "Can't tell how old this is — the board dated it in the future."
                  : "Nothing new for over two minutes — these numbers are history, not the room."}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 opacity-80">
                <li>
                  Is the board on the <em>same</em> network as this server? Phone
                  hotspots and campus WiFi usually block device-to-device traffic.
                </li>
                <li>
                  Does <code>studbud.json</code> point at this machine&apos;s LAN
                  IP? <code>localhost</code> on the board means the board.
                </li>
                <li>
                  App Lab&apos;s Python console should print <code>post: 201</code>{" "}
                  about once a minute. <code>401</code> means the token
                  doesn&apos;t match <code>STUDBUD_INGEST_TOKEN</code>.
                </li>
                <li>
                  If the board sends its own <code>recordedAt</code>, its clock
                  has to be roughly right — leave the field out and the server
                  timestamps the sweep on arrival.
                </li>
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
