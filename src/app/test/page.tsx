import type { Metadata } from "next";
import SensorTest from "@/components/SensorTest";
import { listSpaces } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sensor test bench · Stud-Bud",
  description:
    "Send four raw sensor values to the Stud-Bud ingest API and see exactly what the server does with them.",
};

export default async function TestPage() {
  return <SensorTest initialSpaces={await listSpaces()} />;
}
