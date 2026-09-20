import { NextResponse } from "next/server";
import { evaluate } from "@/lib/score";
import { bestHour, getSpace, hourlyHistory } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const space = await getSpace(id);
  if (!space) {
    return NextResponse.json({ errors: [`unknown space "${id}"`] }, { status: 404 });
  }

  const hourly = await hourlyHistory(id);
  return NextResponse.json({
    space: { ...space, verdict: evaluate(space.latest) },
    hourly,
    bestHour: bestHour(hourly),
  });
}
