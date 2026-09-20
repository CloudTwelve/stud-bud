import type { IngestPayload } from "./store";

type Unknown = Record<string, unknown>;

// A miswired or misconfigured sensor reports confidently rather than failing -
// a DHT11 decoded as a DHT22 yields 307C and 3807% RH. One such sweep skews a
// room's score and its 24h trend, so implausible values are refused at the
// door. The bounds are generous: they reject broken hardware, not hot rooms.
const RANGES: Record<string, [number, number, string]> = {
  temperature: [-20, 60, "\u00b0C"],
  humidity: [0, 100, "%"],
  sound: [0, 160, "dB"],
  light: [0, 150000, "lux"],
};

function num(body: Unknown, key: string, errors: string[]): number {
  const raw = body[key];
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`"${key}" must be a finite number`);
    return 0;
  }
  const range = RANGES[key];
  if (range && (value < range[0] || value > range[1])) {
    errors.push(
      `"${key}" of ${value}${range[2]} is outside ${range[0]}-${range[1]}${range[2]}:` +
        " check the sensor rather than the dashboard",
    );
  }
  return value;
}

function optionalNum(
  body: Unknown,
  key: string,
  errors: string[],
): number | undefined {
  return body[key] === undefined || body[key] === null
    ? undefined
    : num(body, key, errors);
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
    occupiedSeats: optionalNum(input, "occupiedSeats", errors),
    totalSeats: optionalNum(input, "totalSeats", errors),
    recordedAt: str(input, "recordedAt"),
  };

  const { occupiedSeats, totalSeats } = payload;
  if ((occupiedSeats === undefined) !== (totalSeats === undefined)) {
    errors.push('send "occupiedSeats" and "totalSeats" together, or neither');
  }
  if (
    occupiedSeats !== undefined &&
    totalSeats !== undefined &&
    errors.length === 0
  ) {
    if (totalSeats < 0 || occupiedSeats < 0) {
      errors.push("seat counts must be non-negative");
    }
    if (occupiedSeats > totalSeats) {
      errors.push('"occupiedSeats" cannot exceed "totalSeats"');
    }
  }
  if (payload.recordedAt && Number.isNaN(Date.parse(payload.recordedAt))) {
    errors.push('"recordedAt" must be an ISO 8601 timestamp');
  }

  return errors.length > 0 ? { errors } : { payload };
}
