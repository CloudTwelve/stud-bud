import type { Metadata } from "next";
import Link from "next/link";
import HeroGrid from "@/components/HeroGrid";
import {
  ArrowIcon,
  BoltIcon,
  BookIcon,
  DogIcon,
  DropletIcon,
  GridIcon,
  LightIcon,
  SeatIcon,
  SignalIcon,
  SoundIcon,
  ThermometerIcon,
} from "@/components/Icons";
import Logo from "@/components/Logo";
import LiteToggle from "@/components/LiteToggle";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Stud-Bud — is this room worth studying in?",
  description:
    "Stud-Bud turns temperature, humidity, noise, light and seat counts from an Arduino and a robot dog into a straight answer: is this room worth walking to?",
};

const METRICS = [
  {
    label: "Noise",
    unit: "dB",
    icon: SoundIcon,
    ideal: "under 45 dB",
    why: "The single best predictor of whether you'll actually get work done.",
    sensor: "Electret mic + amplifier, calibrated against an SPL meter",
  },
  {
    label: "Free seats",
    unit: "seats",
    icon: SeatIcon,
    ideal: "a quarter of the room still open",
    why: "A perfect room with no chairs is not a room you can study in.",
    sensor: "Doorway counter, per-table sensors, or the dog's camera",
  },
  {
    label: "Temperature",
    unit: "°C",
    icon: ThermometerIcon,
    ideal: "19–23.5 °C",
    why: "Above ~24 °C is the sleepy zone; below 19 °C you fidget instead of read.",
    sensor: "DHT22",
  },
  {
    label: "Light",
    unit: "lux",
    icon: LightIcon,
    ideal: "300–800 lux",
    why: "Too dim strains your eyes, too bright is glare on the laptop screen.",
    sensor: "Modulino Light",
  },
  {
    label: "Humidity",
    unit: "% RH",
    icon: DropletIcon,
    ideal: "30–55 %",
    why: "Stuffy air is the reason a packed library feels exhausting after an hour.",
    sensor: "DHT22",
  },
];

const PIPELINE = [
  {
    step: "Sense",
    icon: ThermometerIcon,
    body: "An Arduino in each room samples temperature, humidity, light and a one-second noise envelope every minute. The robot dog patrols and counts people the static node can't see.",
  },
  {
    step: "Send",
    icon: SignalIcon,
    body: "Each sweep is one authenticated JSON POST to /api/readings. Anything that can make an HTTP request — a second dog, a phone, a laptop script — can feed the same endpoint.",
  },
  {
    step: "Score",
    icon: BoltIcon,
    body: "Every metric is scored 0–100 against a comfort band, then combined with your weights. Each number comes back with the plain-English reason behind it, never just a verdict.",
  },
  {
    step: "Decide",
    icon: BookIcon,
    body: "Rooms rank live as readings land. Stale rooms stop being scored instead of quietly lying to you, and the 24-hour history tells you the quietest hour to come back.",
  },
];

export default function HomePage() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <section className="relative isolate overflow-hidden border-b border-line">
        <HeroGrid />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--background)]" />

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-20 sm:px-8 sm:py-28">
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3">
            <Logo className="h-7 sm:h-9" />
            <div className="flex items-center gap-2">
              <Link
                href="/rooms"
                className="panel-sm clip-tag flex items-center gap-2 px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 hover:border-line-strong"
              >
                <GridIcon className="h-4 w-4 text-brand" />
                Live rooms
                <ArrowIcon className="h-4 w-4 text-accent" />
              </Link>
              <LiteToggle />
              <ThemeToggle />
            </div>
          </div>

          <div className="pointer-events-none max-w-3xl">
            <p className="eyebrow">
              <DogIcon className="h-4 w-4" />
              HackMIT · Arduino + robot dog
            </p>
            <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-7xl">
              Stop walking to full,
              <br />
              loud,{" "}
              <span className="bg-gradient-to-r from-[var(--brand)] to-[var(--accent)] bg-clip-text text-transparent">
                freezing rooms.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base opacity-75 sm:text-lg">
              Stud-Bud reads a room the way you would if you could be in five
              places at once — how loud it is, how full it is, whether the air
              and light are bearable — and turns that into one number you can
              act on before you pack your bag.
            </p>
          </div>

          <div className="pointer-events-auto flex flex-wrap items-center gap-3">
            <Link
              href="/rooms"
              className="clip-btn on-accent flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5"
            >
              See which room wins right now
              <ArrowIcon className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/CloudTwelve/stud-bud/tree/main/hardware"
              className="panel-sm clip-btn px-5 py-2.5 text-sm font-medium transition hover:-translate-y-0.5 hover:border-line-strong"
            >
              Build the sensor node
            </a>
            <span className="text-xs opacity-50">
              Drag across the grid, or click it — it sweeps like the dog does.
              On bad WiFi, hit Low-WiFi mode and it all holds still.
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-16 sm:px-8 sm:py-20">
        <section className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <p className="eyebrow">The gap</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
              The problem is information, not space
            </h2>
            <p className="mt-4 text-sm opacity-75 sm:text-base">
              Campuses have plenty of seats. What they don&apos;t have is any way
              to know, from where you&apos;re standing, which of those seats is
              quiet and free right now. So everyone guesses, walks ten minutes,
              finds a full room, and guesses again.
            </p>
            <p className="mt-3 text-sm opacity-75 sm:text-base">
              Occupancy dashboards that only count badge swipes miss the half of
              the problem you actually feel: the group project shouting two
              tables over, the radiator, the glare. Stud-Bud measures the room,
              not the door.
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {PIPELINE.map((stage, index) => (
              <li
                key={stage.step}
                className="panel p-5 transition hover:-translate-y-0.5 hover:border-line-strong"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center bg-[var(--surface-muted)] text-brand">
                    <stage.icon className="h-4 w-4" />
                  </span>
                  <span className="font-mono text-xs tracking-[0.2em] text-accent">
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-3 text-lg font-semibold">{stage.step}</p>
                <p className="mt-1 text-sm opacity-75">{stage.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <p className="eyebrow">Signals</p>
          <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
            What gets measured, and why it earns its place
          </h2>
          <p className="mt-3 max-w-2xl text-sm opacity-75 sm:text-base">
            Five signals, each scored 0–100 against the range people actually
            work well in. Nothing is a black box: every card on the dashboard
            shows the reading, the score and the sentence explaining it.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {METRICS.map((metric) => (
              <article
                key={metric.label}
                className="panel p-5 transition hover:-translate-y-0.5 hover:border-line-strong"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <metric.icon className="h-4 w-4 text-brand" />
                    {metric.label}
                  </h3>
                  <span className="font-mono text-xs opacity-50">
                    {metric.unit}
                  </span>
                </div>
                <p className="mt-2 text-sm opacity-75">{metric.why}</p>
                <dl className="mt-4 space-y-1 text-xs opacity-60">
                  <div className="flex gap-2">
                    <dt className="font-semibold">Ideal</dt>
                    <dd>{metric.ideal}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold">Sensor</dt>
                    <dd>{metric.sensor}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="panel p-6">
            <h2 className="text-xl font-semibold">
              &ldquo;Good room&rdquo; is personal
            </h2>
            <p className="mt-3 text-sm opacity-75">
              Someone writing a problem set wants silence; someone killing forty
              minutes between classes just wants a chair. The{" "}
              <strong>Personalized</strong> sort on the dashboard re-weights
              every metric to what you say matters, recomputes each room&apos;s
              score, and re-ranks them. Your weights stay in your browser — no
              account, no tracking.
            </p>
          </div>
          <div className="panel p-6">
            <h2 className="text-xl font-semibold">Honest about staleness</h2>
            <p className="mt-3 text-sm opacity-75">
              Sensor projects fail by looking confident with old data. If a room
              hasn&apos;t reported in 45 minutes Stud-Bud hides its score, marks
              it stale, shows when it was last seen, and drops it out of the
              recommendation. An unknown room is better than a wrong one.
            </p>
          </div>
        </section>

        <section className="panel p-6 sm:p-8">
          <p className="eyebrow">Contract</p>
          <h2 className="mt-3 text-xl font-semibold sm:text-2xl">
            Anything can be a sensor
          </h2>
          <p className="mt-3 max-w-2xl text-sm opacity-75">
            The whole hardware contract is one POST. Seat fields are optional —
            leave them out and the last count the dog measured is kept — so an
            environment node and a people counter can report at completely
            different rates.
          </p>
          <pre className="clip-tag mt-4 overflow-x-auto bg-[var(--code-bg)] p-4 font-mono text-xs text-[color:var(--brand-soft)]">
{`POST /api/readings
{
  "spaceId": "hayden-reading-room",
  "temperature": 21.4,
  "humidity": 42,
  "sound": 34,
  "light": 520,
  "occupiedSeats": 28,
  "totalSeats": 60
}`}
          </pre>
          <p className="mt-4 text-sm opacity-75">
            Wiring, parts and calibration steps live in the{" "}
            <a
              className="underline decoration-[var(--accent)] decoration-2 underline-offset-4"
              href="https://github.com/CloudTwelve/stud-bud/tree/main/hardware"
            >
              hardware guide
            </a>
            .
          </p>
        </section>

        <section className="panel flex flex-col items-start gap-4 bg-gradient-to-r from-[var(--brand)]/12 via-transparent to-[var(--accent)]/15 p-8 sm:items-center sm:text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Find somewhere to study
          </h2>
          <p className="max-w-xl text-sm opacity-75">
            Live scores for every room the sensors reach, updated the instant a
            sweep lands. IHTFP is optional; a quiet room helps.
          </p>
          <Link
            href="/rooms"
            className="clip-btn on-accent flex items-center gap-2 px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
          >
            Open the live dashboard
            <ArrowIcon className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </main>
  );
}
