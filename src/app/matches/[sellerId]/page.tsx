import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/match-card";
import { getSeller, listMatchesForSeller } from "@/lib/db";
import {
  PROPERTY_TYPE_LABELS,
  TIMELINE_LABELS,
} from "@/lib/types";

export const metadata = {
  title: "Your Agent Matches — AgentMatch",
};

// Data changes at runtime (new sellers/agents), so always render fresh.
export const dynamic = "force-dynamic";

export default async function MatchResultsPage({
  params,
}: {
  params: { sellerId: string };
}) {
  const seller = await getSeller(params.sellerId);
  if (!seller) notFound();

  const matches = (await listMatchesForSeller(seller.id)).slice(0, 3);

  return (
    <div className="bg-secondary/40 py-14">
      <div className="container max-w-4xl">
        <div className="mb-10 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
            <CheckCircle2 className="h-4 w-4" />
            Analysis complete
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            {seller.full_name.split(" ")[0]}, here are your top{" "}
            {matches.length} agents
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Ranked for your {PROPERTY_TYPE_LABELS[seller.property_type].toLowerCase()}{" "}
            in {seller.city} ({seller.zip_code}) and your{" "}
            {TIMELINE_LABELS[seller.timeline].toLowerCase()} timeline.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <Badge variant="info">{seller.property_address}</Badge>
            <Badge variant="muted">
              Seller intent score: {seller.intent_score}/100
            </Badge>
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">
            No agents currently serve your area. Check back soon — new agents
            join weekly.
          </div>
        ) : (
          <div className="space-y-6">
            {matches.map((match, i) => (
              <MatchCard key={match.id} match={match} rank={i + 1} />
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link href="/dashboard/seller">
            <Button variant="outline">
              <LayoutDashboard className="h-4 w-4" />
              Go to my seller dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
