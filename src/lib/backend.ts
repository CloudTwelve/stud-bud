import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { HourlyPoint, Reading } from "./types";

export interface SpaceRow {
  id: string;
  name: string;
  building: string;
}

export interface Backend {
  kind: "sqlite" | "memory";
  listSpaces(): SpaceRow[];
  getSpace(id: string): SpaceRow | undefined;
  insertSpace(row: SpaceRow): void;
  renameSpace(id: string, name?: string, building?: string): void;
  history(id: string, limit: number): Reading[];
  /** Newest reading at or before `recordedAt`, or undefined if none precedes it. */
  readingBefore(id: string, recordedAt: string): Reading | undefined;
  hourly(id: string, hours: number): HourlyPoint[];
  insertReading(reading: Reading): void;
  isEmpty(): boolean;
}

const DB_PATH = process.env.STUDBUD_DB
  ? resolve(/* turbopackIgnore: true */ process.env.STUDBUD_DB)
  : join(process.cwd(), ".data", "studbud.db");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    building TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    space_id TEXT NOT NULL REFERENCES spaces(id),
    temperature REAL NOT NULL,
    humidity REAL NOT NULL,
    sound REAL NOT NULL,
    light REAL NOT NULL,
    occupied_seats INTEGER NOT NULL,
    total_seats INTEGER NOT NULL,
    recorded_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS readings_space_time
    ON readings (space_id, recorded_at DESC);
`;

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

function sqliteBackend(): Backend | null {
  try {
    // `process.getBuiltinModule` keeps bundlers from trying to resolve
    // `node:sqlite`, which only exists on Node 22.5+.
    const sqlite = process.getBuiltinModule?.("node:sqlite") as
      | { DatabaseSync: new (path: string) => DatabaseSync }
      | undefined;
    if (!sqlite) return null;

    mkdirSync(dirname(DB_PATH), { recursive: true });
    const db = new sqlite.DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec(SCHEMA);

    return {
      kind: "sqlite",
      listSpaces: () =>
        db
          .prepare("SELECT id, name, building FROM spaces ORDER BY name")
          .all() as unknown as SpaceRow[],
      getSpace: (id) =>
        db.prepare("SELECT id, name, building FROM spaces WHERE id = ?").get(id) as
          | SpaceRow
          | undefined,
      insertSpace: (row) =>
        void db
          .prepare("INSERT OR IGNORE INTO spaces (id, name, building) VALUES (?, ?, ?)")
          .run(row.id, row.name, row.building),
      renameSpace: (id, name, building) =>
        void db
          .prepare(
            `UPDATE spaces SET name = COALESCE(?, name), building = COALESCE(?, building)
             WHERE id = ?`,
          )
          .run(name ?? null, building ?? null, id),
      history: (id, limit) =>
        (
          db
            .prepare(
              `SELECT * FROM readings WHERE space_id = ?
               ORDER BY recorded_at DESC LIMIT ?`,
            )
            .all(id, limit) as unknown as ReadingRow[]
        )
          .map(toReading)
          .reverse(),
      readingBefore: (id, recordedAt) => {
        const row = db
          .prepare(
            `SELECT * FROM readings WHERE space_id = ? AND recorded_at <= ?
             ORDER BY recorded_at DESC LIMIT 1`,
          )
          .get(id, recordedAt) as unknown as ReadingRow | undefined;
        return row ? toReading(row) : undefined;
      },
      hourly: (id, hours) => {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        const rows = db
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
          .all(id, since) as unknown as HourlyPoint[];
        return rows.map((row) => ({ ...row, hour: `${row.hour}:00:00.000Z` }));
      },
      insertReading: (reading) =>
        void db
          .prepare(
            `INSERT INTO readings
               (space_id, temperature, humidity, sound, light, occupied_seats, total_seats, recorded_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            reading.spaceId,
            reading.temperature,
            reading.humidity,
            reading.sound,
            reading.light,
            reading.occupiedSeats,
            reading.totalSeats,
            reading.recordedAt,
          ),
      isEmpty: () =>
        (db.prepare("SELECT COUNT(*) AS count FROM spaces").get() as { count: number })
          .count === 0,
    };
  } catch (error) {
    console.warn("[stud-bud] could not open SQLite", error);
    return null;
  }
}

function memoryBackend(): Backend {
  const spaces = new Map<string, SpaceRow>();
  const readings = new Map<string, Reading[]>();

  return {
    kind: "memory",
    listSpaces: () =>
      [...spaces.values()].sort((a, b) => a.name.localeCompare(b.name)),
    getSpace: (id) => spaces.get(id),
    insertSpace: (row) => {
      if (!spaces.has(row.id)) spaces.set(row.id, row);
    },
    renameSpace: (id, name, building) => {
      const row = spaces.get(id);
      if (!row) return;
      spaces.set(id, {
        id,
        name: name ?? row.name,
        building: building ?? row.building,
      });
    },
    history: (id, limit) => (readings.get(id) ?? []).slice(-limit),
    readingBefore: (id, recordedAt) =>
      (readings.get(id) ?? [])
        .filter((reading) => reading.recordedAt <= recordedAt)
        .pop(),
    hourly: (id, hours) => {
      const since = Date.now() - hours * 60 * 60 * 1000;
      const buckets = new Map<string, Reading[]>();
      for (const reading of readings.get(id) ?? []) {
        if (Date.parse(reading.recordedAt) < since) continue;
        const key = reading.recordedAt.slice(0, 13);
        const bucket = buckets.get(key);
        if (bucket) bucket.push(reading);
        else buckets.set(key, [reading]);
      }
      const mean = (values: number[]) =>
        values.reduce((sum, value) => sum + value, 0) / values.length;

      return [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, group]) => ({
          hour: `${hour}:00:00.000Z`,
          temperature: mean(group.map((r) => r.temperature)),
          humidity: mean(group.map((r) => r.humidity)),
          sound: mean(group.map((r) => r.sound)),
          light: mean(group.map((r) => r.light)),
          fullness: mean(
            group.map((r) => r.occupiedSeats / Math.max(1, r.totalSeats)),
          ),
          samples: group.length,
        }));
    },
    insertReading: (reading) => {
      const list = readings.get(reading.spaceId) ?? [];
      list.push(reading);
      list.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
      readings.set(reading.spaceId, list);
    },
    isEmpty: () => spaces.size === 0,
  };
}

const globalBackend = globalThis as typeof globalThis & {
  __studBudBackend?: Backend;
};

/**
 * SQLite whenever the runtime has `node:sqlite` and a writable disk; otherwise
 * an in-process store so read-only serverless hosts still serve the dashboard
 * (history then lives only as long as the instance).
 */
export function backend(): Backend {
  if (!globalBackend.__studBudBackend) {
    const sqlite = process.env.STUDBUD_MEMORY_STORE === "1" ? null : sqliteBackend();
    if (!sqlite) {
      console.warn(
        "[stud-bud] SQLite unavailable (read-only filesystem or Node < 22.5); " +
          "falling back to an in-memory store; history resets with the instance.",
      );
    }
    globalBackend.__studBudBackend = sqlite ?? memoryBackend();
  }
  return globalBackend.__studBudBackend;
}
