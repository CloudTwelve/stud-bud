import { db } from "./db";
import { READING_RECORDED, readingEvents } from "./events";
import { seedIfEmpty } from "./seed";
import type { HourlyPoint, Reading, Space } from "./types";

const HISTORY_POINTS = 48;
export const STALE_AFTER_MINUTES = 45;

interface ReadingRow {
  space_id: string;
  temperature: number;
  humidity: number;
  sound: number;
  light: number;
  occupied_seats: number;
  total_seats: number;
  recorded_at: string;
}

function toReading(row: ReadingRow): Reading {
  return {
    spaceId: row.space_id,
    temperature: row.temperature,
    humidity: row.humidity,
    sound: row.sound,
    light: row.light,
    occupiedSeats: row.occupied_seats,
    totalSeats: row.total_seats,
    recordedAt: row.recorded_at,
  };
}

export function isStale(reading: Reading): boolean {
  const age = Date.now() - Date.parse(reading.recordedAt);
  return !Number.isFinite(age) || age > STALE_AFTER_MINUTES * 60 * 1000;
}

function historyFor(spaceId: string): Reading[] {
  const rows = db()
    .prepare(
      `SELECT * FROM readings WHERE space_id = ?
       ORDER BY recorded_at DESC LIMIT ?`,
    )
    .all(spaceId, HISTORY_POINTS) as unknown as ReadingRow[];
  return rows.map(toReading).reverse();
}

function assemble(row: { id: string; name: string; building: string }): Space | null {
  const history = historyFor(row.id);
  if (history.length === 0) return null;
  const latest = history[history.length - 1];
  return {
    id: row.id,
    name: row.name,
    building: row.building,
    latest,
    history,
    stale: isStale(latest),
  };
}

export function listSpaces(): Space[] {
  seedIfEmpty();
  const rows = db()
    .prepare("SELECT id, name, building FROM spaces ORDER BY name")
    .all() as unknown as { id: string; name: string; building: string }[];
  return rows
    .map(assemble)
    .filter((space): space is Space => space !== null);
}

export function getSpace(id: string): Space | undefined {
  seedIfEmpty();
  const row = db()
    .prepare("SELECT id, name, building FROM spaces WHERE id = ?")
    .get(id) as { id: string; name: string; building: string } | undefined;
  return row ? (assemble(row) ?? undefined) : undefined;
}

export function hourlyHistory(id: string, hours = 24): HourlyPoint[] {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const rows = db()
    .prepare(
      `SELECT
         substr(recorded_at, 1, 13) AS hour,
         AVG(temperature) AS temperature,
         AVG(humidity) AS humidity,
         AVG(sound) AS sound,
         AVG(light) AS light,
         AVG(CAST(occupied_seats AS REAL) / MAX(total_seats, 1)) AS fullness,
         COUNT(*) AS samples
       FROM readings
       WHERE space_id = ? AND recorded_at >= ?
       GROUP BY hour
       ORDER BY hour`,
    )
    .all(id, since) as unknown as (Omit<HourlyPoint, "hour"> & { hour: string })[];

  return rows.map((row) => ({
    hour: `${row.hour}:00:00.000Z`,
    temperature: Number(row.temperature.toFixed(1)),
    humidity: Number(row.humidity.toFixed(1)),
    sound: Number(row.sound.toFixed(1)),
    light: Math.round(row.light),
    fullness: Number(row.fullness.toFixed(3)),
    samples: row.samples,
  }));
}

/** The hour of day (local) with the lowest noise + fullness across the window. */
export function bestHour(points: HourlyPoint[]): { hour: number; sound: number } | null {
  if (points.length === 0) return null;
  const best = [...points].sort(
    (a, b) => a.sound + a.fullness * 30 - (b.sound + b.fullness * 30),
  )[0];
  return { hour: new Date(best.hour).getHours(), sound: best.sound };
}

export interface IngestPayload {
  spaceId: string;
  name?: string;
  building?: string;
  temperature: number;
  humidity: number;
  sound: number;
  light: number;
  occupiedSeats: number;
  totalSeats: number;
  recordedAt?: string;
}

export function recordReading(payload: IngestPayload): Space {
  seedIfEmpty();
  const recordedAt = payload.recordedAt ?? new Date().toISOString();

  db()
    .prepare("INSERT OR IGNORE INTO spaces (id, name, building) VALUES (?, ?, ?)")
    .run(
      payload.spaceId,
      payload.name ?? payload.spaceId,
      payload.building ?? "Unknown building",
    );

  if (payload.name || payload.building) {
    db()
      .prepare(
        `UPDATE spaces
         SET name = COALESCE(?, name), building = COALESCE(?, building)
         WHERE id = ?`,
      )
      .run(payload.name ?? null, payload.building ?? null, payload.spaceId);
  }

  db()
    .prepare(
      `INSERT INTO readings
         (space_id, temperature, humidity, sound, light, occupied_seats, total_seats, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      payload.spaceId,
      payload.temperature,
      payload.humidity,
      payload.sound,
      payload.light,
      payload.occupiedSeats,
      payload.totalSeats,
      recordedAt,
    );

  const space = getSpace(payload.spaceId);
  if (!space) throw new Error(`space ${payload.spaceId} vanished after insert`);
  readingEvents().emit(READING_RECORDED, space.id);
  return space;
}
