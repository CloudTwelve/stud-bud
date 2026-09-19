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
| `STUDBUD_DB` | SQLite file path. Defaults to `.data/studbud.db`. |
| `STUDBUD_BASE_URL` | Public URL used for Open Graph / share metadata. |

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

The Arduino / robot dog posts one JSON payload per sweep:

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
| `occupiedSeats` / `totalSeats` | seats | yes |
| `name`, `building` | labels for a new room | no |
| `recordedAt` | ISO 8601, defaults to now | no |

Readings are stored in SQLite (`.data/studbud.db` by default, created and
seeded with demo rooms on first boot), so history survives restarts. The
dashboard updates the instant a sweep lands via `/api/stream`, with a 30 s poll
as a fallback.
