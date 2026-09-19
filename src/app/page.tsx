import Dashboard from "@/components/Dashboard";
import { listSpaces } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Dashboard initialSpaces={listSpaces()} />;
}
