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

export interface IngestPayload {
  spaceId: string;
  name?: string;
  building?: string;
  temperature: number;
  humidity: number;
  sound: number;
  light: number;
  /** Omit both seat fields to keep the room's last known occupancy. */
  occupiedSeats?: number;
  totalSeats?: number;
  recordedAt?: string;
}

export class MissingSeatCountsError extends Error {
  constructor(spaceId: string) {
    super(
      `"occupiedSeats" and "totalSeats" are required for new space ${spaceId}`,
    );
  }
}

export async function recordReading(payload: IngestPayload): Promise<Space> {
  await seedIfEmpty();
  const store = await backend();

  const previous = (await store.history(payload.spaceId, 1))[0];
  const occupiedSeats = payload.occupiedSeats ?? previous?.occupiedSeats;
  const totalSeats = payload.totalSeats ?? previous?.totalSeats;
  if (occupiedSeats === undefined || totalSeats === undefined) {
    throw new MissingSeatCountsError(payload.spaceId);
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
    temperature: payload.temperature,
    humidity: payload.humidity,
    sound: payload.sound,
    light: payload.light,
    occupiedSeats,
    totalSeats,
    recordedAt: payload.recordedAt ?? new Date().toISOString(),
  });

  const space = await getSpace(payload.spaceId);
  if (!space) throw new Error(`space ${payload.spaceId} vanished after insert`);
  readingEvents().emit(READING_RECORDED, space.id);
  return space;
}
