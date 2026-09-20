"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Space } from "@/lib/types";

const POLL_MS = 15000;
/** Re-render the "last sweep" clock even when nothing new arrives. */
const TICK_MS = 1000;
const SILENT_AFTER_S = 120;
/** A reading dated further ahead than this means the board's clock is wrong. */
const SKEW_TOLERANCE_S = 60;

function elapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

const READOUTS = [
  { key: "temperature", label: "Temperature", unit: "°C", digits: 1 },
  { key: "humidity", label: "Humidity", unit: "% RH", digits: 0 },
  { key: "sound", label: "Noise", unit: "dB", digits: 0 },
  { key: "light", label: "Light", unit: "lux", digits: 0 },
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
          const response = await fetch("/api/readings", { cache: "no-store" });
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
    <section className="card rounded-3xl p-5 sm:p-6">
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
            className={`h-2 w-2 rounded-full ${connected ? "animate-pulse bg-emerald-400" : "bg-slate-400"}`}
          />
          {connected ? "stream open" : "stream closed"}
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-rose-400/10 px-4 py-3 text-sm text-rose-500">
          Can&apos;t reach the server ({error}). The board can&apos;t either, then.
        </p>
      )}

      {spaces.length > 0 && (
        <label className="mt-4 flex flex-col gap-1">
          <span className="text-sm font-medium">Watching</span>
          <select
            value={space?.id ?? ""}
            onChange={(event) => setSelected(event.target.value)}
            className="rounded-2xl border border-[var(--surface-border)] bg-transparent px-4 py-2 text-sm outline-none focus:border-fuchsia-400"
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
              <div key={readout.key} className="rounded-2xl bg-black/5 p-4 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.15em] opacity-60">
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
            <span className={silent ? "text-amber-500" : "opacity-75"}>
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
              className="underline decoration-fuchsia-400 underline-offset-4"
            >
              full history →
            </Link>
          </p>

          {silent && (
            <div className="mt-4 rounded-2xl bg-amber-400/10 px-4 py-3 text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">
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
