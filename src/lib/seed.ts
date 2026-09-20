import { backend } from "./backend";

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
  /** How much busier the room gets at its midday peak, 0-1 of total seats. */
  peakFill: number;
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
    peakFill: 0.75,
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
    peakFill: 0.95,
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
    peakFill: 0.6,
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
    peakFill: 0.55,
  },
];

/** 0 at 4am, 1 around 2pm — a rough campus busyness curve. */
function dailyCurve(hour: number): number {
  const shifted = ((hour - 4 + 24) % 24) / 24;
  return Math.sin(shifted * Math.PI) ** 1.6;
}

export function seedIfEmpty(): void {
  if (process.env.STUDBUD_NO_SEED === "1") return;
  const store = backend();
  if (!store.isEmpty()) return;

  const now = Date.now();
  for (const seed of SEEDS) {
    store.insertSpace({ id: seed.id, name: seed.name, building: seed.building });

    // 24 hours of sweeps, every 20 minutes.
    for (let step = 24 * 3; step >= 0; step -= 1) {
      const at = new Date(now - step * 20 * 60 * 1000);
      const busy = dailyCurve(at.getHours() + at.getMinutes() / 60);
      const noise = (spread: number) => (Math.random() - 0.5) * spread;

      store.insertReading({
        spaceId: seed.id,
        temperature: Number((seed.temperature + busy * 1.8 + noise(0.6)).toFixed(1)),
        humidity: Number((seed.humidity + busy * 6 + noise(3)).toFixed(1)),
        sound: Number((seed.sound - 8 + busy * 18 + noise(4)).toFixed(1)),
        light: Math.round(seed.light + busy * 120 + noise(60)),
        occupiedSeats: Math.max(
          0,
          Math.min(
            seed.totalSeats,
            Math.round(seed.totalSeats * seed.peakFill * busy + noise(3)),
          ),
        ),
        totalSeats: seed.totalSeats,
        recordedAt: at.toISOString(),
      });
    }
  }
}
