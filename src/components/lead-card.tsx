import { Flame, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MatchScore } from "@/components/match-score";
import { LeadStatusSelect } from "@/components/lead-status-select";
import { MatchWithSeller } from "@/lib/db";
import {
  CONDITION_LABELS,
  PROPERTY_TYPE_LABELS,
  SELLING_GOAL_LABELS,
  TIMELINE_LABELS,
} from "@/lib/types";

/**
 * Seller-opportunity card shown on the agent dashboard.
 * Seller contact details are intentionally partial — in a real product,
 * full contact info would unlock after the lead is accepted/purchased.
 */
export function LeadCard({ lead }: { lead: MatchWithSeller }) {
  const { seller } = lead;
  const urgent = seller.timeline === "now" || seller.timeline === "30_days";

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <MatchScore score={lead.score} size="md" />

        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 font-semibold text-primary">
              <MapPin className="h-4 w-4 text-accent" />
              {seller.city}, {seller.state} {seller.zip_code}
            </span>
            {urgent && (
              <Badge variant="warning" className="gap-1">
                <Flame className="h-3 w-3" /> Hot lead
              </Badge>
            )}
            <Badge variant="muted">Intent {seller.intent_score}/100</Badge>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">Type:</span>{" "}
              {PROPERTY_TYPE_LABELS[seller.property_type]}
            </span>
            <span>
              <span className="font-medium text-foreground">Condition:</span>{" "}
              {CONDITION_LABELS[seller.condition]}
            </span>
            <span>
              <span className="font-medium text-foreground">Timeline:</span>{" "}
              {TIMELINE_LABELS[seller.timeline]}
            </span>
            <span>
              <span className="font-medium text-foreground">Goal:</span>{" "}
              {SELLING_GOAL_LABELS[seller.selling_goal]}
            </span>
          </div>
        </div>

        <div className="sm:w-44">
          <LeadStatusSelect
            leadStatusId={lead.lead_status_id}
            current={lead.lead_status}
          />
        </div>
      </CardContent>
    </Card>
  );
}
