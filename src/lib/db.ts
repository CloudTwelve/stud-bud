import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = process.env.STUDBUD_DB
  ? resolve(/* turbopackIgnore: true */ process.env.STUDBUD_DB)
  : join(process.cwd(), ".data", "studbud.db");

function open(): DatabaseSync {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`
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
  `);
  return db;
}

const globalDb = globalThis as typeof globalThis & {
  __studBudDb?: DatabaseSync;
};

export function db(): DatabaseSync {
  globalDb.__studBudDb ??= open();
  return globalDb.__studBudDb;
}
