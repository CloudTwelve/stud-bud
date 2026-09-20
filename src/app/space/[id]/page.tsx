import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SpaceDetail from "@/components/SpaceDetail";
import { evaluate } from "@/lib/score";
import { bestHour, getSpace, hourlyHistory } from "@/lib/store";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const space = await getSpace(id);
  return {
    title: space ? `${space.name} · Stud-Bud` : "Room not found · Stud-Bud",
    description: space
      ? `Live noise, temperature, light and free seats in ${space.name}, ${space.building}.`
      : undefined,
  };
}

export default async function SpacePage({ params }: PageProps) {
  const { id } = await params;
  const space = await getSpace(id);
  if (!space) notFound();

  const hourly = await hourlyHistory(id);
  return (
    <SpaceDetail
      initial={{
        space: { ...space, verdict: evaluate(space.latest) },
        hourly,
        bestHour: bestHour(hourly),
      }}
    />
  );
}
