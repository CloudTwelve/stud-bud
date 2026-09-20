# stud-bud

This is the website made to work with my team's HackMIT 2026 submission. It pulls the data collected by the Arduino and robot dog, presenting it in a clear manner. Ultimately, users can understand how ideal a study space is, to make their decision on whether or not to study there.

## Running locally

```bash
npm install
npm run dev     # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `STUDBUD_INGEST_TOKEN` | When set, `POST /api/readings` requires `Authorization: Bearer <token>`. Unset means open ingest (local development only). |
| `DATABASE_URL` | Postgres connection string. When set, it is used instead of SQLite — this is what makes readings durable on a serverless host. `POSTGRES_URL` and `STUDBUD_POSTGRES_URL` are also accepted. |
| `STUDBUD_DB` | SQLite file path, used when no Postgres URL is set. Defaults to `.data/studbud.db`. |
| `STUDBUD_MEMORY_STORE` | Set to `1` to skip SQLite and keep readings in memory. |
| `STUDBUD_BASE_URL` | Public URL used for Open Graph / share metadata. |
| `STUDBUD_NO_SEED` | Set to `1` to never generate the five demo rooms, so the dashboard shows only rooms real hardware has posted. |

Storage is chosen at startup: Postgres if a connection string is configured,
otherwise SQLite on disk, otherwise an in-memory store that resets with the
process. Local development needs no database at all.

### Deploying

On Vercel, attach a Postgres database (Storage → Create Database → Neon) so
`DATABASE_URL` is injected; without it every request gets a fresh machine with
a read-only disk and readings vanish. For hardware to POST to the deployment,
turn off Settings → Deployment Protection → Vercel Authentication, which
otherwise answers unauthenticated requests with a redirect to Vercel's login.
Full steps are in [`docs/LIVE-DEMO.md`](docs/LIVE-DEMO.md).

Going live with real hardware — what to switch off, in what order — is in
[`docs/DEMO-DAY.md`](docs/DEMO-DAY.md), which also has a reading order for the
codebase.

## How the score works

Each sweep of a room is scored 0-100. Temperature, humidity, noise, light and
free seats are each scored against a comfortable band (e.g. 19-23.5 °C, under
45 dB, 300-800 lux) and combined with weights that favour quiet and available
seats. `src/lib/score.ts` holds the bands, default weights and the
plain-English comments shown on each card.

The **Personalized** ranking rescores every room with the weights you set in
the preferences panel (quiet, free seats, temperature, light, fresh air). Those
weights are stored in `localStorage`, so the ranking follows you between
visits.

A room whose last sweep is older than 45 minutes is marked stale: its score is
hidden and it drops to the bottom of every ranking instead of pretending the
readings are current.

## Pages and APIs

| Route | What it does |
| --- | --- |
| `/` | Dashboard: all rooms, sorting, preferences, live updates |
| `/space/[id]` | One room: current sweep, 24 h trends, quietest hour, recent sweeps |
| `GET /api/readings` | Every room with latest reading, recent history and verdict |
| `POST /api/readings` | Hardware ingest (see below) |
| `GET /api/spaces/[id]` | One room plus hourly 24 h aggregates and its quietest hour |
| `GET /api/stream` | Server-sent events; emits the room id on every new sweep |

## Sending data from the hardware

Parts list, wiring, calibration and a ready-to-flash sketch live in
[`hardware/`](hardware/README.md). The Arduino / robot dog posts one JSON
payload per sweep:

```bash
curl -X POST http://localhost:3000/api/readings \
  -H "authorization: Bearer $STUDBUD_INGEST_TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "spaceId": "hayden-reading-room",
    "name": "Hayden Reading Room",
    "building": "Building 14",
    "temperature": 21.4,
    "humidity": 42,
    "sound": 34,
    "light": 520,
    "occupiedSeats": 28,
    "totalSeats": 60
  }'
```

| Field | Unit | Required |
| --- | --- | --- |
| `spaceId` | stable id for the room | yes |
| `temperature` | °C | yes |
| `humidity` | % RH | yes |
| `sound` | dB | yes |
| `light` | lux | yes |
| `occupiedSeats` / `totalSeats` | seats | yes for a room's first sweep |
| `name`, `building` | labels for a new room | no |
| `recordedAt` | ISO 8601, defaults to now | no |

Send the two seat fields together or leave both out. A sweep without them
keeps the room's last known occupancy, so an environment-only node (no seat
sensor) does not wipe the count the robot dog measured on its last patrol.

Readings are stored in SQLite (`.data/studbud.db` by default, created and
seeded with demo rooms on first boot), so history survives restarts. The
dashboard updates the instant a sweep lands via `/api/stream`, with a 30 s poll
as a fallback.

## Deploying

SQLite needs Node 22.5+ (for `node:sqlite`) and a writable disk. On hosts
without one — Vercel and most serverless platforms mount a read-only
filesystem — the app logs a warning and falls back to an in-process store: the
dashboard, scoring, trends and ingest all work, but each instance starts from
the seeded demo data and history is lost when the instance recycles. Run it on
a machine with a disk (a Raspberry Pi, a VM, `npm run start` on a laptop) for
real persistence, or point the app at a hosted database.
