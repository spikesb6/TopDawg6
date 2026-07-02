import {
  Gauge,
  Home,
  Link2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { getAdminStats } from "@/lib/db";
import {
  PROPERTY_TYPE_LABELS,
  TIMELINE_LABELS,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata = {
  title: "Admin — AgentMatch",
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();

  return (
    <div className="bg-secondary/40 py-12">
      <div className="container max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Admin dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Marketplace health at a glance.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total sellers" value={stats.totalSellers} icon={Home} />
          <StatCard label="Total agents" value={stats.totalAgents} icon={Users} />
          <StatCard label="Total matches" value={stats.totalMatches} icon={Link2} />
          <StatCard
            label="Avg match score"
            value={`${stats.avgMatchScore}/100`}
            icon={Gauge}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent sellers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary">
                Recent seller submissions
              </CardTitle>
              <CardDescription>Latest homeowner intake forms.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.recentSellers.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-primary">{s.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {s.city}, {s.state} {s.zip_code} ·{" "}
                      {PROPERTY_TYPE_LABELS[s.property_type]}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">
                        {TIMELINE_LABELS[s.timeline]}
                      </Badge>
                      <Badge variant="accent">
                        Intent {s.intent_score}/100
                      </Badge>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(s.created_at)}
                  </span>
                </div>
              ))}
              {stats.recentSellers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No sellers yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent agents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary">
                Recent agent signups
              </CardTitle>
              <CardDescription>Newest agents on the platform.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.recentAgents.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-primary">{a.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.brokerage} · {a.years_experience} yrs ·{" "}
                      {a.homes_sold_last_12mo} sold/12mo
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {a.service_zip_codes.slice(0, 4).map((z) => (
                        <Badge key={z} variant="secondary">
                          {z}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(a.created_at)}
                  </span>
                </div>
              ))}
              {stats.recentAgents.length === 0 && (
                <p className="text-sm text-muted-foreground">No agents yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
