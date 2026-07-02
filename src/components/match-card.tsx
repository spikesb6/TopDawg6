/* eslint-disable @next/next/no-img-element */
import {
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Mail,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MatchScore } from "@/components/match-score";
import { MatchWithAgent } from "@/lib/db";
import { SPECIALTY_LABELS } from "@/lib/types";
import { initials } from "@/lib/utils";

/**
 * Agent match card shown to the homeowner on the match results page.
 */
export function MatchCard({
  match,
  rank,
}: {
  match: MatchWithAgent;
  rank: number;
}) {
  const { agent } = match;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardContent className="p-0">
        <div className="flex flex-col gap-6 p-6 md:flex-row">
          {/* Photo + score */}
          <div className="flex items-start gap-4 md:w-64 md:shrink-0">
            <div className="relative">
              {agent.photo_url ? (
                <img
                  src={agent.photo_url}
                  alt={agent.full_name}
                  className="h-20 w-20 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-navy-100 text-xl font-bold text-navy-700">
                  {initials(agent.full_name)}
                </div>
              )}
              {rank === 1 && (
                <Badge
                  variant="accent"
                  className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-accent text-white"
                >
                  Top Match
                </Badge>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-primary">
                {agent.full_name}
              </h3>
              <p className="text-sm text-muted-foreground">{agent.brokerage}</p>
              <div className="mt-2">
                <MatchScore score={match.score} size="sm" />
              </div>
            </div>
          </div>

          {/* Why matched + stats */}
          <div className="flex-1">
            <p className="mb-2 text-sm font-semibold text-primary">
              Why this agent matched
            </p>
            <ul className="mb-4 space-y-1.5">
              {match.reasons.map((reason) => (
                <li
                  key={reason}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {reason}
                </li>
              ))}
            </ul>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Award className="h-4 w-4 text-navy-600" />
                {agent.years_experience} yrs exp
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-navy-600" />
                {agent.homes_sold_last_12mo} sold/12mo
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4 text-navy-600" />
                {agent.avg_days_on_market} avg DOM
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-navy-600" />
                {Math.round(agent.avg_list_to_sale_ratio * 100)}% of list
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {agent.specialties.map((s) => (
                <Badge key={s} variant="secondary">
                  {SPECIALTY_LABELS[s]}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 border-t bg-secondary/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <a href={`mailto:${agent.email}`} className="sm:w-auto">
            <Button variant="outline" className="w-full">
              <Mail className="h-4 w-4" />
              Contact {agent.full_name.split(" ")[0]}
            </Button>
          </a>
          <a
            href={`mailto:${agent.email}?subject=Interview%20request%20via%20AgentMatch`}
            className="sm:w-auto"
          >
            <Button variant="accent" className="w-full">
              <CalendarCheck className="h-4 w-4" />
              Schedule Interview
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
