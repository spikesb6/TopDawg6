"use client";

import { useTransition } from "react";
import { Select } from "@/components/ui/select";
import { setLeadStatus } from "@/app/actions";
import { LeadStatus, LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/types";

/**
 * Dropdown that updates a lead's pipeline status via a server action.
 */
export function LeadStatusSelect({
  leadStatusId,
  current,
}: {
  leadStatusId: string;
  current: LeadStatus;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      name="status"
      defaultValue={current}
      disabled={isPending}
      aria-label="Lead status"
      onChange={(e) => {
        const formData = new FormData();
        formData.set("lead_status_id", leadStatusId);
        formData.set("status", e.target.value);
        startTransition(() => setLeadStatus(formData));
      }}
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s}>
          {LEAD_STATUS_LABELS[s]}
        </option>
      ))}
    </Select>
  );
}
