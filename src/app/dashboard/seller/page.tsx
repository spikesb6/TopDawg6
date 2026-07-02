import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bath,
  BedDouble,
  DollarSign,
  Gauge,
  Home,
  Ruler,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { MatchCard } from "@/components/match-card";
import { getSessionIds } from "@/app/actions";
import { getSeller, listMatchesForSeller } from "@/lib/db";
import {
  CONDITION_LABELS,
  PROPERTY_TYPE_LABELS,
  SELLING_GOAL_LABELS,
  SELLING_REASON_LABELS,
  TIMELINE_LABELS,
} from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const metadata = {
  title: "Seller Dashboard — AgentMatch",
};

export const dynamic = "force-dynamic";

export default async function SellerDashboardPage() {
  const { sellerId } = await getSessionIds();
  if (!sellerId) redirect("/login");

  const seller = await getSeller(sellerId);
  if (!seller) redirect("/login");

  const matches = (await listMatchesForSeller(seller.id)).slice(0, 3);

  return (
    <div className="bg-secondary/40 py-12">
      <div className="container max-w-5xl space-y-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              Welcome back, {seller.full_name.split(" ")[0]}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {seller.property_address}, {seller.city}, {seller.state}{" "}
              {seller.zip_code}
            </p>
          </div>
          <Link href="/sell">
            <Button variant="outline" size="sm">
              <Home className="h-4 w-4" />
              Submit another property
            </Button>
          </Link>
        </div>

        {/* Property snapshot */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Estimated value"
            value={seller.estimated_value ? formatCurrency(seller.estimated_value) : "—"}
            icon={DollarSign}
          />
          <StatCard
            label="Seller intent score"
            value={`${seller.intent_score}/100`}
            icon={Gauge}
            hint="How ready-to-sell you look to agents"
          />
          <StatCard
            label="Matched agents"
            value={matches.length}
            icon={Users}
          />
          <StatCard
            label="Square footage"
            value={seller.square_footage ? formatNumber(seller.square_footage) : "—"}
            icon={Ruler}
          />
        </div>

        {/* Listing profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">Your listing profile</CardTitle>
            <CardDescription>
              This is what the matching algorithm uses to rank agents for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="info">
              {PROPERTY_TYPE_LABELS[seller.property_type]}
            </Badge>
            <Badge variant="secondary">
              Condition: {CONDITION_LABELS[seller.condition]}
            </Badge>
            <Badge variant="secondary">
              <BedDouble className="mr-1 h-3 w-3" /> {seller.bedrooms} bd
            </Badge>
            <Badge variant="secondary">
              <Bath className="mr-1 h-3 w-3" /> {seller.bathrooms} ba
            </Badge>
            <Badge variant="secondary">
              Timeline: {TIMELINE_LABELS[seller.timeline]}
            </Badge>
            <Badge variant="secondary">
              Reason: {SELLING_REASON_LABELS[seller.selling_reason]}
            </Badge>
            <Badge variant="accent">
              Goal: {SELLING_GOAL_LABELS[seller.selling_goal]}
            </Badge>
          </CardContent>
        </Card>

        {/* Matches */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-primary">
            Your matched agents
          </h2>
          {matches.length === 0 ? (
            <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">
              No matches yet — new agents join weekly.
            </div>
          ) : (
            <div className="space-y-6">
              {matches.map((match, i) => (
                <MatchCard key={match.id} match={match} rank={i + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
