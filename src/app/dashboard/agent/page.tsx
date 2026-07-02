import { redirect } from "next/navigation";
import {
  Briefcase,
  Flame,
  Handshake,
  MapPin,
  Target,
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
import { LeadCard } from "@/components/lead-card";
import { getSessionIds } from "@/app/actions";
import { getAgent, listLeadsForAgent } from "@/lib/db";
import { SPECIALTY_LABELS } from "@/lib/types";

export const metadata = {
  title: "Agent Dashboard — AgentMatch",
};

export const dynamic = "force-dynamic";

export default async function AgentDashboardPage() {
  const { agentId } = await getSessionIds();
  if (!agentId) redirect("/login");

  const agent = await getAgent(agentId);
  if (!agent) redirect("/login");

  const leads = await listLeadsForAgent(agent.id);
  const hotLeads = leads.filter(
    (l) =>
      l.seller.timeline === "now" || l.seller.timeline === "30_days"
  ).length;
  const activePipeline = leads.filter(
    (l) => l.lead_status === "contacted" || l.lead_status === "appointment_set"
  ).length;
  const won = leads.filter((l) => l.lead_status === "won").length;

  return (
    <div className="bg-secondary/40 py-12">
      <div className="container max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Lead pipeline
          </h1>
          <p className="mt-1 text-muted-foreground">
            {agent.full_name} · {agent.brokerage} · License{" "}
            {agent.license_number}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Matched leads" value={leads.length} icon={Target} />
          <StatCard label="Hot leads" value={hotLeads} icon={Flame} hint="Selling now or within 30 days" />
          <StatCard label="In progress" value={activePipeline} icon={Briefcase} />
          <StatCard label="Won" value={won} icon={Handshake} />
        </div>

        {/* Coverage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">Your coverage</CardTitle>
            <CardDescription>
              You&apos;re matched to sellers in these ZIP codes and specialties.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {agent.service_zip_codes.map((z) => (
              <Badge key={z} variant="info">
                <MapPin className="mr-1 h-3 w-3" />
                {z}
              </Badge>
            ))}
            {agent.specialties.map((s) => (
              <Badge key={s} variant="secondary">
                {SPECIALTY_LABELS[s]}
              </Badge>
            ))}
          </CardContent>
        </Card>

        {/* Leads */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-primary">
            Seller opportunities
          </h2>
          {leads.length === 0 ? (
            <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">
              No matched leads yet. Leads appear here automatically when
              homeowners in your ZIP codes submit their property.
            </div>
          ) : (
            <div className="space-y-4">
              {leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
