import { NextResponse } from "next/server";
import { ingestAuthorized } from "@/lib/auth";
import { evaluate } from "@/lib/score";
import {
  IncompleteFirstReadingError,
  SeatCountError,
  listSpaces,
  recordReading,
} from "@/lib/store";
import { parseIngest } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  const spaces = (await listSpaces()).map((space) => ({
    ...space,
    verdict: evaluate(space.latest),
  }));
  return NextResponse.json({ spaces, updatedAt: new Date().toISOString() });
}

export async function POST(request: Request) {
  if (!ingestAuthorized(request)) {
    return NextResponse.json(
      { errors: ["missing or invalid bearer token"] },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errors: ["body must be valid JSON"] }, { status: 400 });
  }

  const parsed = parseIngest(body);
  if ("errors" in parsed) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  let space;
  try {
    space = await recordReading(parsed.payload);
  } catch (error) {
    if (
      error instanceof IncompleteFirstReadingError ||
      error instanceof SeatCountError
    ) {
      return NextResponse.json({ errors: [error.message] }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json(
    { space: { ...space, verdict: evaluate(space.latest) } },
    { status: 201 },
  );
}
