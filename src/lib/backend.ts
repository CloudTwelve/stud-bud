import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { QueryResultRow } from "pg";
import type { HourlyPoint, Reading } from "./types";

export interface SpaceRow {
  id: string;
  name: string;
  building: string;
}

/**
 * Every method is async because Postgres is a server over the network. SQLite
 * answers immediately and simply returns already-resolved promises.
 */
export interface Backend {
  kind: "sqlite" | "memory" | "postgres";
  listSpaces(): Promise<SpaceRow[]>;
  getSpace(id: string): Promise<SpaceRow | undefined>;
  insertSpace(row: SpaceRow): Promise<void>;
  renameSpace(id: string, name?: string, building?: string): Promise<void>;
  history(id: string, limit: number): Promise<Reading[]>;
  hourly(id: string, hours: number): Promise<HourlyPoint[]>;
  insertReading(reading: Reading): Promise<void>;
  insertReadings(readings: Reading[]): Promise<void>;
  isEmpty(): Promise<boolean>;
  /**
   * Run `fill` at most once across every instance sharing this database.
   * Serverless hosts answer requests on many machines at once, so seeding has
   * to be a mutual exclusion problem rather than an `if (empty)` check.
   */
  seedOnce(fill: () => Promise<void>): Promise<void>;
}

const DB_PATH = process.env.STUDBUD_DB
  ? resolve(/* turbopackIgnore: true */ process.env.STUDBUD_DB)
  : join(process.cwd(), ".data", "studbud.db");

const POSTGRES_URL =
  process.env.STUDBUD_POSTGRES_URL ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;

/** Any integer; Postgres advisory locks are keyed by number, not by name. */
const SEED_LOCK_KEY = 8_213_057;

const SQLITE_SCHEMA = `
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

const POSTGRES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    building TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS readings (
    id BIGSERIAL PRIMARY KEY,
    space_id TEXT NOT NULL REFERENCES spaces(id),
    temperature DOUBLE PRECISION NOT NULL,
    humidity DOUBLE PRECISION NOT NULL,
    sound DOUBLE PRECISION NOT NULL,
    light DOUBLE PRECISION NOT NULL,
    occupied_seats INTEGER NOT NULL,
    total_seats INTEGER NOT NULL,
    recorded_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS readings_space_time
    ON readings (space_id, recorded_at DESC);
  CREATE TABLE IF NOT EXISTS seed_state (
    id INTEGER PRIMARY KEY,
    completed_at TEXT NOT NULL
  );
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
    temperature: Number(row.temperature),
    humidity: Number(row.humidity),
    sound: Number(row.sound),
    light: Number(row.light),
    occupiedSeats: Number(row.occupied_seats),
    totalSeats: Number(row.total_seats),
    recordedAt: row.recorded_at,
  };
}

function sqliteBackend(): Backend | null {
  try {
    // `process.getBuiltinModule` keeps bundlers from trying to resolve
    // `node:sqlite`, which only exists on Node 22.5+.
    const sqlite = process.getBuiltinModule?.("node:sqlite") as
      { DatabaseSync: new (path: string) => DatabaseSync } | undefined;
    if (!sqlite) return null;

    mkdirSync(dirname(DB_PATH), { recursive: true });
    const db = new sqlite.DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec(SQLITE_SCHEMA);

    const insert = (reading: Reading) =>
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
        );

    const isEmpty = async () =>
      (
        db.prepare("SELECT COUNT(*) AS count FROM spaces").get() as {
          count: number;
        }
      ).count === 0;

    return {
      kind: "sqlite",
      listSpaces: async () =>
        db
          .prepare("SELECT id, name, building FROM spaces ORDER BY name")
          .all() as unknown as SpaceRow[],
      getSpace: async (id) =>
        db
          .prepare("SELECT id, name, building FROM spaces WHERE id = ?")
          .get(id) as SpaceRow | undefined,
      insertSpace: async (row) =>
        void db
          .prepare(
            "INSERT OR IGNORE INTO spaces (id, name, building) VALUES (?, ?, ?)",
          )
          .run(row.id, row.name, row.building),
      renameSpace: async (id, name, building) =>
        void db
          .prepare(
            `UPDATE spaces SET name = COALESCE(?, name), building = COALESCE(?, building)
             WHERE id = ?`,
          )
          .run(name ?? null, building ?? null, id),
      history: async (id, limit) =>
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
      hourly: async (id, hours) => {
        const since = new Date(
          Date.now() - hours * 60 * 60 * 1000,
        ).toISOString();
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
      insertReading: async (reading) => insert(reading),
      insertReadings: async (readings) => {
        db.exec("BEGIN");
        try {
          for (const reading of readings) insert(reading);
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      },
      isEmpty,
      seedOnce: async (fill) => {
        if (await isEmpty()) await fill();
      },
    };
  } catch (error) {
    console.warn("[stud-bud] could not open SQLite", error);
    return null;
  }
}

/**
 * Hosted providers present certificates that verify against the normal root
 * store, so verification stays on. `sslmode=no-verify` (or
 * `STUDBUD_PG_INSECURE_SSL=1`) is the escape hatch for a private CA, and a
 * local Postgres usually speaks no TLS at all.
 */
function sslFor(url: string): false | { rejectUnauthorized: boolean } {
  if (/sslmode=disable|@localhost|@127\.0\.0\.1/.test(url)) return false;
  if (/sslmode=no-verify/.test(url) || process.env.STUDBUD_PG_INSECURE_SSL === "1") {
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

/** Watch for another instance's seed to finish, giving up rather than hanging. */
async function waitForSeed(seeded: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 25; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (await seeded()) return;
  }
}

async function postgresBackend(url: string): Promise<Backend | null> {
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: url,
      ssl: sslFor(url),
      max: 3,
    });
    try {
      await pool.query(POSTGRES_SCHEMA);
    } catch (error) {
      // A pool outlives the request that built it, and `backend()` rebuilds
      // after a failure, so a durable setup error (no DDL rights, say) would
      // otherwise pile up one live pool per request.
      await pool.end();
      throw error;
    }

    const query = async <T extends QueryResultRow>(
      text: string,
      values: unknown[] = [],
    ) => (await pool.query<T>(text, values)).rows;

    const isEmpty = async () =>
      (
        await query<{ count: string }>("SELECT COUNT(*) AS count FROM spaces")
      )[0].count === "0";

    // Waiters watch this marker rather than the first space to appear: `fill`
    // commits room by room, so "not empty" would hand them a half-seeded
    // campus. A database seeded before the marker existed counts as done.
    const seeded = async () =>
      (
        await query<{ count: string }>(
          "SELECT COUNT(*) AS count FROM seed_state",
        )
      )[0].count !== "0" || !(await isEmpty());

    const markSeeded = async () => {
      await query(
        `INSERT INTO seed_state (id, completed_at) VALUES (1, $1)
         ON CONFLICT (id) DO NOTHING`,
        [new Date().toISOString()],
      );
    };

    return {
      kind: "postgres",
      listSpaces: () =>
        query<SpaceRow>("SELECT id, name, building FROM spaces ORDER BY name"),
      getSpace: async (id) =>
        (
          await query<SpaceRow>(
            "SELECT id, name, building FROM spaces WHERE id = $1",
            [id],
          )
        )[0],
      insertSpace: async (row) => {
        await query(
          `INSERT INTO spaces (id, name, building) VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING`,
          [row.id, row.name, row.building],
        );
      },
      renameSpace: async (id, name, building) => {
        await query(
          `UPDATE spaces SET name = COALESCE($1, name), building = COALESCE($2, building)
           WHERE id = $3`,
          [name ?? null, building ?? null, id],
        );
      },
      history: async (id, limit) =>
        (
          await query<ReadingRow>(
            `SELECT * FROM readings WHERE space_id = $1
             ORDER BY recorded_at DESC LIMIT $2`,
            [id, limit],
          )
        )
          .map(toReading)
          .reverse(),
      hourly: async (id, hours) => {
        const since = new Date(
          Date.now() - hours * 60 * 60 * 1000,
        ).toISOString();
        const rows = await query<{
          hour: string;
          temperature: number;
          humidity: number;
          sound: number;
          light: number;
          fullness: number;
          samples: string;
        }>(
          `SELECT
             substr(recorded_at, 1, 13) AS hour,
             AVG(temperature) AS temperature,
             AVG(humidity) AS humidity,
             AVG(sound) AS sound,
             AVG(light) AS light,
             AVG(occupied_seats::float / GREATEST(total_seats, 1)) AS fullness,
             COUNT(*) AS samples
           FROM readings
           WHERE space_id = $1 AND recorded_at >= $2
           GROUP BY hour
           ORDER BY hour`,
          [id, since],
        );
        return rows.map((row) => ({
          hour: `${row.hour}:00:00.000Z`,
          temperature: Number(row.temperature),
          humidity: Number(row.humidity),
          sound: Number(row.sound),
          light: Number(row.light),
          fullness: Number(row.fullness),
          samples: Number(row.samples),
        }));
      },
      insertReading: async (reading) => {
        await query(
          `INSERT INTO readings
             (space_id, temperature, humidity, sound, light, occupied_seats, total_seats, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            reading.spaceId,
            reading.temperature,
            reading.humidity,
            reading.sound,
            reading.light,
            reading.occupiedSeats,
            reading.totalSeats,
            reading.recordedAt,
          ],
        );
      },
      insertReadings: async (readings) => {
        if (readings.length === 0) return;
        const values: unknown[] = [];
        const tuples = readings.map((reading, index) => {
          values.push(
            reading.spaceId,
            reading.temperature,
            reading.humidity,
            reading.sound,
            reading.light,
            reading.occupiedSeats,
            reading.totalSeats,
            reading.recordedAt,
          );
          const base = index * 8;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
        });
        await query(
          `INSERT INTO readings
             (space_id, temperature, humidity, sound, light, occupied_seats, total_seats, recorded_at)
           VALUES ${tuples.join(", ")}`,
          values,
        );
      },
      isEmpty,
      seedOnce: async (fill) => {
        if (await seeded()) return;

        // Try for the lock rather than waiting on it: a waiting client is a
        // checked-out client, and enough of those starve `fill` of the
        // connections it needs. Losers hand their client back and watch for
        // the winner to finish instead.
        const client = await pool.connect();
        let locked = false;
        try {
          locked = (
            await client.query<{ locked: boolean }>(
              "SELECT pg_try_advisory_lock($1) AS locked",
              [SEED_LOCK_KEY],
            )
          ).rows[0].locked;
          if (locked) {
            if (await isEmpty()) await fill();
            await markSeeded();
          }
        } finally {
          try {
            if (locked) {
              await client.query("SELECT pg_advisory_unlock($1)", [
                SEED_LOCK_KEY,
              ]);
            }
          } finally {
            client.release();
          }
        }

        if (!locked) await waitForSeed(seeded);
      },
    };
  } catch (error) {
    console.warn("[stud-bud] could not open Postgres", error);
    return null;
  }
}

function memoryBackend(): Backend {
  const spaces = new Map<string, SpaceRow>();
  const readings = new Map<string, Reading[]>();

  const insert = (reading: Reading) => {
    const list = readings.get(reading.spaceId) ?? [];
    list.push(reading);
    list.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    readings.set(reading.spaceId, list);
  };

  const isEmpty = async () => spaces.size === 0;

  return {
    kind: "memory",
    listSpaces: async () =>
      [...spaces.values()].sort((a, b) => a.name.localeCompare(b.name)),
    getSpace: async (id) => spaces.get(id),
    insertSpace: async (row) => {
      if (!spaces.has(row.id)) spaces.set(row.id, row);
    },
    renameSpace: async (id, name, building) => {
      const row = spaces.get(id);
      if (!row) return;
      spaces.set(id, {
        id,
        name: name ?? row.name,
        building: building ?? row.building,
      });
    },
    history: async (id, limit) => (readings.get(id) ?? []).slice(-limit),
    hourly: async (id, hours) => {
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
    insertReading: async (reading) => insert(reading),
    insertReadings: async (list) => {
      for (const reading of list) insert(reading);
    },
    isEmpty,
    seedOnce: async (fill) => {
      if (await isEmpty()) await fill();
    },
  };
}

const globalBackend = globalThis as typeof globalThis & {
  __studBudBackend?: Promise<Backend>;
};

async function open(): Promise<Backend> {
  if (process.env.STUDBUD_MEMORY_STORE === "1") return memoryBackend();

  if (POSTGRES_URL) {
    const postgres = await postgresBackend(POSTGRES_URL);
    // Never quietly downgrade to a store that forgets: a configured database
    // means readings are expected to survive, so a database that is briefly
    // unreachable has to surface as a failed request and be retried.
    if (!postgres) throw new Error("configured Postgres database is unavailable");
    return postgres;
  }

  const sqlite = sqliteBackend();
  if (sqlite) return sqlite;

  console.warn(
    "[stud-bud] no Postgres URL and SQLite unavailable (read-only filesystem " +
      "or Node < 22.5); falling back to an in-memory store; history resets " +
      "with the instance.",
  );
  return memoryBackend();
}

/**
 * Postgres when a connection string is configured — the only option that
 * survives on a serverless host, where the filesystem is read-only and every
 * request may land on a different machine. Otherwise SQLite on disk, and
 * in-memory as a last resort so the dashboard still renders.
 *
 * The promise itself is cached, so concurrent callers share one pool.
 */
export function backend(): Promise<Backend> {
  globalBackend.__studBudBackend ??= open().catch((error) => {
    globalBackend.__studBudBackend = undefined;
    throw error;
  });
  return globalBackend.__studBudBackend;
}
