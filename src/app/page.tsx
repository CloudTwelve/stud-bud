import Dashboard from "@/components/Dashboard";
import { evaluate } from "@/lib/score";
import { listSpaces } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Home() {
  const spaces = listSpaces().map((space) => ({
    ...space,
    verdict: evaluate(space.latest),
  }));

  return <Dashboard initialSpaces={spaces} />;
}
