import type { Reading, Space } from "./types";

const MAX_HISTORY = 48;

interface SpaceSeed {
  id: string;
  name: string;
  building: string;
  temperature: number;
  humidity: number;
  sound: number;
  light: number;
  occupiedSeats: number;
  totalSeats: number;
}

const SEEDS: SpaceSeed[] = [
  {
    id: "hayden-reading-room",
    name: "Hayden Reading Room",
    building: "Building 14",
    temperature: 21.4,
    humidity: 42,
    sound: 34,
    light: 520,
    occupiedSeats: 28,
    totalSeats: 60,
  },
  {
    id: "stud-cafe",
    name: "Student Center Café",
    building: "W20",
    temperature: 24.6,
    humidity: 58,
    sound: 67,
    light: 410,
    occupiedSeats: 44,
    totalSeats: 50,
  },
  {
    id: "barker-dome",
    name: "Barker Dome",
    building: "Building 10",
    temperature: 20.1,
    humidity: 37,
    sound: 41,
    light: 880,
    occupiedSeats: 12,
    totalSeats: 45,
  },
  {
    id: "stata-basement",
    name: "Stata Basement Lounge",
    building: "Building 32",
    temperature: 18.2,
    humidity: 64,
    sound: 52,
    light: 180,
    occupiedSeats: 9,
    totalSeats: 24,
  },
];

function jitter(base: number, spread: number, step: number): number {
  return (
    base + Math.sin(step * 1.7 + base) * spread + (Math.random() - 0.5) * spread * 0.4
  );
}

function seedHistory(seed: SpaceSeed): Reading[] {
  const now = Date.now();
  const readings: Reading[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    readings.push({
      spaceId: seed.id,
      temperature: Number(jitter(seed.temperature, 0.8, i).toFixed(1)),
      humidity: Number(jitter(seed.humidity, 4, i).toFixed(1)),
      sound: Number(jitter(seed.sound, 6, i).toFixed(1)),
      light: Math.round(jitter(seed.light, 60, i)),
      occupiedSeats: Math.max(
        0,
        Math.min(seed.totalSeats, Math.round(jitter(seed.occupiedSeats, 4, i))),
      ),
      totalSeats: seed.totalSeats,
      recordedAt: new Date(now - i * 10 * 60 * 1000).toISOString(),
    });
  }
  return readings;
}

function seedSpaces(): Map<string, Space> {
  const spaces = new Map<string, Space>();
  for (const seed of SEEDS) {
    const history = seedHistory(seed);
    spaces.set(seed.id, {
      id: seed.id,
      name: seed.name,
      building: seed.building,
      latest: history[history.length - 1],
      history,
    });
  }
  return spaces;
}

const globalStore = globalThis as typeof globalThis & {
  __studBudSpaces?: Map<string, Space>;
};

function spaces(): Map<string, Space> {
  globalStore.__studBudSpaces ??= seedSpaces();
  return globalStore.__studBudSpaces;
}

export function listSpaces(): Space[] {
  return [...spaces().values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getSpace(id: string): Space | undefined {
  return spaces().get(id);
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
  const reading: Reading = {
    spaceId: payload.spaceId,
    temperature: payload.temperature,
    humidity: payload.humidity,
    sound: payload.sound,
    light: payload.light,
    occupiedSeats: payload.occupiedSeats,
    totalSeats: payload.totalSeats,
    recordedAt: payload.recordedAt ?? new Date().toISOString(),
  };

  const existing = spaces().get(payload.spaceId);
  const space: Space = existing
    ? {
        ...existing,
        name: payload.name ?? existing.name,
        building: payload.building ?? existing.building,
        latest: reading,
        history: [...existing.history, reading].slice(-MAX_HISTORY),
      }
    : {
        id: payload.spaceId,
        name: payload.name ?? payload.spaceId,
        building: payload.building ?? "Unknown building",
        latest: reading,
        history: [reading],
      };

  spaces().set(space.id, space);
  return space;
}
