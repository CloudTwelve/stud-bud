import type { IngestPayload } from "./store";

type Unknown = Record<string, unknown>;

function num(body: Unknown, key: string, errors: string[]): number {
  const raw = body[key];
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`"${key}" must be a finite number`);
    return 0;
  }
  return value;
}

function str(body: Unknown, key: string): string | undefined {
  const raw = body[key];
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
}

export function parseIngest(
  body: unknown,
): { payload: IngestPayload } | { errors: string[] } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { errors: ["body must be a JSON object"] };
  }
  const input = body as Unknown;
  const errors: string[] = [];

  const spaceId = str(input, "spaceId");
  if (!spaceId) errors.push('"spaceId" is required');

  const payload: IngestPayload = {
    spaceId: spaceId ?? "",
    name: str(input, "name"),
    building: str(input, "building"),
    temperature: num(input, "temperature", errors),
    humidity: num(input, "humidity", errors),
    sound: num(input, "sound", errors),
    light: num(input, "light", errors),
    occupiedSeats: num(input, "occupiedSeats", errors),
    totalSeats: num(input, "totalSeats", errors),
    recordedAt: str(input, "recordedAt"),
  };

  if (payload.totalSeats < 0 || payload.occupiedSeats < 0) {
    errors.push("seat counts must be non-negative");
  }
  if (payload.occupiedSeats > payload.totalSeats) {
    errors.push('"occupiedSeats" cannot exceed "totalSeats"');
  }
  if (payload.recordedAt && Number.isNaN(Date.parse(payload.recordedAt))) {
    errors.push('"recordedAt" must be an ISO 8601 timestamp');
  }

  return errors.length > 0 ? { errors } : { payload };
}
