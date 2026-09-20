import { backend } from "./backend";
import { READING_RECORDED, readingEvents } from "./events";
import { seedIfEmpty } from "./seed";
import type { HourlyPoint, Reading, Space } from "./types";

const HISTORY_POINTS = 48;
export const STALE_AFTER_MINUTES = 45;

export function isStale(reading: Reading): boolean {
  const age = Date.now() - Date.parse(reading.recordedAt);
  return !Number.isFinite(age) || age > STALE_AFTER_MINUTES * 60 * 1000;
}

async function assemble(row: {
  id: string;
  name: string;
  building: string;
}): Promise<Space | null> {
  const history = await (await backend()).history(row.id, HISTORY_POINTS);
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

export async function listSpaces(): Promise<Space[]> {
  await seedIfEmpty();
  const rows = await (await backend()).listSpaces();
  const spaces = await Promise.all(rows.map(assemble));
  return spaces.filter((space): space is Space => space !== null);
}

export async function getSpace(id: string): Promise<Space | undefined> {
  await seedIfEmpty();
  const row = await (await backend()).getSpace(id);
  return row ? ((await assemble(row)) ?? undefined) : undefined;
}

export async function hourlyHistory(
  id: string,
  hours = 24,
): Promise<HourlyPoint[]> {
  const points = await (await backend()).hourly(id, hours);
  return points.map((point) => ({
    hour: point.hour,
    temperature: Number(point.temperature.toFixed(1)),
    humidity: Number(point.humidity.toFixed(1)),
    sound: Number(point.sound.toFixed(1)),
    light: Math.round(point.light),
    fullness: Number(point.fullness.toFixed(3)),
    samples: point.samples,
  }));
}

/** The hour of day (local) with the lowest noise + fullness across the window. */
export function bestHour(
  points: HourlyPoint[],
): { hour: number; sound: number } | null {
  if (points.length === 0) return null;
  const best = [...points].sort(
    (a, b) => a.sound + a.fullness * 30 - (b.sound + b.fullness * 30),
  )[0];
  return { hour: new Date(best.hour).getHours(), sound: best.sound };
}

/**
 * Every measurement is optional: a room is watched by more than one device
 * (the board has the sensors, the dog counts seats) and they report on their
 * own schedules. Whatever a sweep omits is carried forward from the room's
 * last reading, so a partial post updates what it knows without erasing the
 * rest.
 */
export interface IngestPayload {
  spaceId: string;
  name?: string;
  building?: string;
  temperature?: number;
  humidity?: number;
  sound?: number;
  light?: number;
  occupiedSeats?: number;
  totalSeats?: number;
  recordedAt?: string;
}

type CarriedField =
  | "temperature"
  | "humidity"
  | "sound"
  | "light"
  | "occupiedSeats"
  | "totalSeats";

/** A sweep with nothing recorded before it has nothing to carry forward, so
 *  it has to be complete. */
export class IncompleteFirstReadingError extends Error {
  constructor(spaceId: string, fields: CarriedField[]) {
    super(
      `nothing is recorded for ${spaceId} before this reading, so it must` +
        ` include every field; missing: ${fields.join(", ")}`,
    );
  }
}

export class SeatCountError extends Error {
  constructor(occupiedSeats: number, totalSeats: number) {
    super(
      `"occupiedSeats" (${occupiedSeats}) cannot exceed "totalSeats"` +
        ` (${totalSeats})`,
    );
  }
}

export async function recordReading(payload: IngestPayload): Promise<Space> {
  await seedIfEmpty();
  const store = await backend();

  // Canonical UTC so stored timestamps sort and compare by instant even when
  // a device posts an offset like `+02:00`.
  const parsed = payload.recordedAt ? Date.parse(payload.recordedAt) : Date.now();
  const recordedAt = new Date(
    Number.isFinite(parsed) ? parsed : Date.now(),
  ).toISOString();

  // What was current at the sweep's own timestamp, not the room's newest row:
  // the dog uploads an offline backlog newest-first, and a backdated sweep
  // must not copy later measurements into earlier history.
  const previous = await store.readingBefore(payload.spaceId, recordedAt);
  const missing: CarriedField[] = [];
  const carry = (field: CarriedField): number => {
    const value = payload[field] ?? previous?.[field];
    if (value === undefined) {
      missing.push(field);
      return 0;
    }
    return value;
  };
  const carried = {
    temperature: carry("temperature"),
    humidity: carry("humidity"),
    sound: carry("sound"),
    light: carry("light"),
    occupiedSeats: carry("occupiedSeats"),
    totalSeats: carry("totalSeats"),
  };
  if (missing.length > 0) {
    throw new IncompleteFirstReadingError(payload.spaceId, missing);
  }
  if (carried.occupiedSeats > carried.totalSeats) {
    throw new SeatCountError(carried.occupiedSeats, carried.totalSeats);
  }

  await store.insertSpace({
    id: payload.spaceId,
    name: payload.name ?? payload.spaceId,
    building: payload.building ?? "Unknown building",
  });
  if (payload.name || payload.building) {
    await store.renameSpace(payload.spaceId, payload.name, payload.building);
  }

  await store.insertReading({
    spaceId: payload.spaceId,
    ...carried,
    recordedAt,
  });

  const space = await getSpace(payload.spaceId);
  if (!space) throw new Error(`space ${payload.spaceId} vanished after insert`);
  readingEvents().emit(READING_RECORDED, space.id);
  return space;
}
