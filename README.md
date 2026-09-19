# stud-bud

This is the website made to work with my team's HackMIT 2026 submission. It pulls the data collected by the Arduino and robot dog, presenting it in a clear manner. Ultimately, users can understand how ideal a study space is, to make their decision on whether or not to study there.

## Running locally

```bash
npm install
npm run dev     # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`.

## How the score works

Each sweep of a room is scored 0-100. Temperature, humidity, noise, light and
free seats are each scored against a comfortable band (e.g. 19-23.5 °C, under
45 dB, 300-800 lux) and combined with weights that favour quiet and available
seats. `src/lib/score.ts` holds the bands, weights and the plain-English
comments shown on each card.

## Sending data from the hardware

The Arduino / robot dog posts one JSON payload per sweep:

```bash
curl -X POST http://localhost:3000/api/readings \
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

`GET /api/readings` returns every room with its latest reading, recent history
and computed verdict — that's what the dashboard polls every 15 seconds.

Readings are kept in memory (seeded with demo rooms on boot), so a restart
resets them; swap `src/lib/store.ts` for a database when the hardware is live.
