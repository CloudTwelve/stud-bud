"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  ArrowIcon,
  BoltIcon,
  DropletIcon,
  GridIcon,
  LightIcon,
  SoundIcon,
  ThermometerIcon,
} from "@/components/Icons";
import LiveFeed from "@/components/LiveFeed";
import ThemeToggle from "@/components/ThemeToggle";
import type { Space } from "@/lib/types";

const SPACE_ID = "sensor-test-bench";

const FIELDS = [
  {
    key: "temperature",
    label: "Temperature",
    unit: "°C",
    icon: ThermometerIcon,
    step: 0.1,
    hint: "DHT22, °C. 19–23.5 scores full marks.",
  },
  {
    key: "humidity",
    label: "Humidity",
    unit: "% RH",
    icon: DropletIcon,
    step: 1,
    hint: "DHT22, relative humidity. 30–55 scores full marks.",
  },
  {
    key: "sound",
    label: "Noise",
    unit: "dB",
    icon: SoundIcon,
    step: 1,
    hint: "Mic peak-to-peak mapped to dB SPL. Under 45 scores full marks.",
  },
  {
    key: "light",
    label: "Light",
    unit: "lux",
    icon: LightIcon,
    step: 10,
    hint: "Modulino Light, lux. 300–800 scores full marks.",
  },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type Values = Record<FieldKey, string>;

type Result = {
  status: number;
  request: unknown;
  response: unknown;
  note?: string;
};

const subscribeToNothing = () => () => {};

async function post(body: Record<string, unknown>, headers: Record<string, string>) {
  const response = await fetch("/api/readings", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { response, json };
}

const START: Values = {
  temperature: "21.4",
  humidity: "42",
  sound: "34",
  light: "520",
};

export default function SensorTest({ initialSpaces }: { initialSpaces: Space[] }) {
  const [values, setValues] = useState<Values>(START);
  const [token, setToken] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const origin = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => "",
  );

  const payload = {
    spaceId: SPACE_ID,
    name: "Sensor test bench",
    building: "Bench",
    temperature: Number(values.temperature),
    humidity: Number(values.humidity),
    sound: Number(values.sound),
    light: Number(values.light),
  };

  const complete = FIELDS.every((field) => Number.isFinite(Number(values[field.key])) && values[field.key].trim() !== "");

  async function send() {
    setSending(true);
    setResult(null);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`;

    try {
      let body: Record<string, unknown> = { ...payload };
      let { response, json } = await post(body, headers);
      let note: string | undefined;

      // A room the server has never seen has no occupancy to carry forward, so
      // the very first post has to name its seats once.
      const errors = (json as { errors?: unknown })?.errors;
      const needsSeats =
        response.status === 400 &&
        Array.isArray(errors) &&
        errors.some((error: unknown) => /seats/i.test(String(error)));
      if (needsSeats) {
        body = { ...payload, occupiedSeats: 0, totalSeats: 1 };
        ({ response, json } = await post(body, headers));
        note =
          "First post for this room: the server had no seat count to keep, so the bench was created with 0/1 seats. Every later post is the four values only.";
      }

      setResult({ status: response.status, request: body, response: json, note });
    } catch (error) {
      setResult({
        status: 0,
        request: payload,
        response: { errors: [String(error)] },
        note: "The request never reached the server — is it running?",
      });
    } finally {
      setSending(false);
    }
  }

  const verdict =
    result?.status === 201
      ? (result.response as { space?: { verdict?: { score: number; headline: string; summary: string } } }).space?.verdict
      : undefined;

  const curl = `curl -X POST ${origin}/api/readings \\
  -H 'content-type: application/json' \\${token.trim() ? `\n  -H 'authorization: Bearer ${token.trim()}' \\` : ""}
  -d '${JSON.stringify(payload)}'`;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8 sm:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">
            <BoltIcon className="h-4 w-4" />
            Ingest playground
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Sensor test bench
          </h1>
          <p className="mt-3 max-w-xl text-sm opacity-75">
            Four numbers, no room to pick and no seat counts — exactly what a
            bare Arduino sends before you wire up people counting. Use it to
            prove your ingest token, your JSON and your calibration one at a
            time — then scroll down to watch the real board once it’s posting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/rooms"
            className="panel-sm clip-tag flex items-center gap-2 px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 hover:border-line-strong"
          >
            <GridIcon className="h-4 w-4 text-brand" />
            Live rooms
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <section className="panel p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between text-sm font-medium">
                <span className="flex items-center gap-2">
                  <field.icon className="h-4 w-4 text-brand" />
                  {field.label}
                </span>
                <span className="font-mono text-xs opacity-50">{field.unit}</span>
              </span>
              <input
                type="number"
                inputMode="decimal"
                step={field.step}
                value={values[field.key]}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
                className="clip-tag border border-line bg-transparent px-4 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]"
              />
              <span className="text-xs opacity-55">{field.hint}</span>
            </label>
          ))}
        </div>

        <label className="mt-4 flex flex-col gap-1">
          <span className="text-sm font-medium">
            Ingest token <span className="opacity-50">(only if the server sets STUDBUD_INGEST_TOKEN)</span>
          </span>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="leave empty when ingest is open"
            className="clip-tag border border-line bg-transparent px-4 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={send}
            disabled={sending || !complete}
            className="clip-btn on-accent px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {sending ? "Sending…" : "Send reading"}
          </button>
          <button
            type="button"
            onClick={() => {
              setValues(START);
              setResult(null);
            }}
            className="panel-sm clip-btn px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 hover:border-line-strong"
          >
            Reset
          </button>
          {!complete && (
            <span className="text-xs opacity-60">All four values must be numbers.</span>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <p className="eyebrow">Request body</p>
          <pre className="clip-tag mt-3 overflow-x-auto bg-[var(--code-bg)] p-4 font-mono text-xs text-[color:var(--brand-soft)]">
{JSON.stringify(payload, null, 2)}
          </pre>
          <p className="mt-3 text-xs opacity-60">
            The same thing from a terminal, so you can check the board and the
            network separately:
          </p>
          <pre className="clip-tag mt-2 overflow-x-auto bg-[var(--code-bg)] p-4 font-mono text-[11px] text-[color:var(--accent-soft)]">
{curl}
          </pre>
        </div>

        <div className="panel p-5">
          <p className="eyebrow">Response</p>
          {!result && (
            <p className="mt-3 text-sm opacity-60">
              Nothing sent yet. A good post answers <code>201</code>; a rejected
              one answers <code>400</code> and tells you which field it disliked.
            </p>
          )}
          {result && (
            <>
              <p className="mt-3 font-mono text-sm">
                <span
                  className={
                    result.status === 201
                      ? "clip-tag bg-[var(--brand)]/20 px-2 py-0.5 text-[color:var(--brand)]"
                      : "clip-tag bg-rose-500/20 px-2 py-0.5 text-rose-500"
                  }
                >
                  HTTP {result.status || "—"}
                </span>
              </p>
              {result.note && <p className="mt-2 text-xs opacity-70">{result.note}</p>}
              {verdict && (
                <p className="mt-3 text-sm">
                  <strong>{verdict.score}/100 — {verdict.headline}.</strong>{" "}
                  <span className="opacity-75">{verdict.summary}</span>
                </p>
              )}
              <pre className="clip-tag mt-3 max-h-72 overflow-auto bg-[var(--code-bg)] p-4 font-mono text-[11px] text-[color:var(--brand-soft)]">
{JSON.stringify(result.response, null, 2)}
              </pre>
              {result.status === 201 && (
                <Link
                  href={`/space/${SPACE_ID}`}
                  className="mt-3 inline-flex items-center gap-2 text-sm underline decoration-[var(--accent)] decoration-2 underline-offset-4"
                >
                  Open the bench room
                  <ArrowIcon className="h-4 w-4 text-accent" />
                </Link>
              )}
            </>
          )}
        </div>
      </section>

      <LiveFeed preferredId={SPACE_ID} initialSpaces={initialSpaces} />

      <section className="panel p-5 sm:p-6">
        <h2 className="text-lg font-semibold">What the board has to do</h2>
        <ol className="mt-3 space-y-2 text-sm opacity-80">
          <li>
            <strong>1.</strong> Read the sensors — temperature and humidity over
            the DHT22&apos;s one-wire protocol, lux from the Modulino Light over
            I²C, and
            a one-second window of microphone samples reduced to a single peak.
          </li>
          <li>
            <strong>2.</strong> Average a minute of samples (but keep the loudest
            noise peak, not the average — a room is judged by how loud it gets).
          </li>
          <li>
            <strong>3.</strong> POST exactly the JSON on the left. Nothing else
            about the board matters to this server.
          </li>
        </ol>
        <p className="mt-3 text-sm opacity-75">
          The line-by-line walkthrough of the firmware — why each sensor was
          chosen, how the mic becomes decibels, and how to calibrate it — is in{" "}
          <a
            className="underline decoration-[var(--accent)] decoration-2 underline-offset-4"
            href="https://github.com/CloudTwelve/stud-bud/blob/main/hardware/HOW-IT-WORKS.md"
          >
            hardware/HOW-IT-WORKS.md
          </a>
          .
        </p>
      </section>
    </main>
  );
}
