"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitSellerIntake, type FormState } from "@/app/actions";
import {
  CONDITIONS,
  CONDITION_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  SELLING_GOALS,
  SELLING_GOAL_LABELS,
  SELLING_REASONS,
  SELLING_REASON_LABELS,
  TIMELINES,
  TIMELINE_LABELS,
} from "@/lib/types";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="accent"
      size="lg"
      className="w-full"
      disabled={pending}
    >
      {pending ? "Finding your matches…" : "See My Top Agents"}
      {!pending && <ArrowRight className="h-5 w-5" />}
    </Button>
  );
}

export function SellerIntakeForm() {
  const [state, formAction] = useFormState<FormState, FormData>(
    submitSellerIntake,
    {}
  );

  return (
    <form action={formAction} className="space-y-8">
      {/* Contact */}
      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-semibold text-primary">
          Your contact info
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="full_name">Full name *</Label>
            <Input id="full_name" name="full_name" placeholder="Jane Smith" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" name="email" type="email" placeholder="jane@email.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone *</Label>
            <Input id="phone" name="phone" type="tel" placeholder="(512) 555-0100" required />
          </div>
        </div>
      </fieldset>

      {/* Property */}
      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-semibold text-primary">
          About the property
        </legend>
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-6">
            <Label htmlFor="property_address">Property address *</Label>
            <Input id="property_address" name="property_address" placeholder="123 Main St" required />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="city">City *</Label>
            <Input id="city" name="city" placeholder="Austin" required />
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="state">State *</Label>
            <Select id="state" name="state" defaultValue="TX" required>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="zip_code">ZIP code *</Label>
            <Input
              id="zip_code"
              name="zip_code"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              placeholder="78704"
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="property_type">Property type *</Label>
            <Select id="property_type" name="property_type" required>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="condition">Estimated condition *</Label>
            <Select id="condition" name="condition" required>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bedrooms">Bedrooms</Label>
            <Input id="bedrooms" name="bedrooms" type="number" min={0} max={20} placeholder="3" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bathrooms">Bathrooms</Label>
            <Input id="bathrooms" name="bathrooms" type="number" min={0} max={20} step={0.5} placeholder="2" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="square_footage">Square footage</Label>
            <Input id="square_footage" name="square_footage" type="number" min={0} placeholder="1800" />
          </div>
          <div className="space-y-1.5 sm:col-span-6">
            <Label htmlFor="estimated_value">Estimated value ($)</Label>
            <Input id="estimated_value" name="estimated_value" type="number" min={0} step={1000} placeholder="450000" />
          </div>
        </div>
      </fieldset>

      {/* Situation */}
      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-semibold text-primary">
          Your selling situation
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="timeline">Selling timeline *</Label>
            <Select id="timeline" name="timeline" required>
              {TIMELINES.map((t) => (
                <option key={t} value={t}>{TIMELINE_LABELS[t]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="selling_reason">Reason for selling *</Label>
            <Select id="selling_reason" name="selling_reason" required>
              {SELLING_REASONS.map((r) => (
                <option key={r} value={r}>{SELLING_REASON_LABELS[r]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="selling_goal">Selling goal *</Label>
            <Select id="selling_goal" name="selling_goal" required>
              {SELLING_GOALS.map((g) => (
                <option key={g} value={g}>{SELLING_GOAL_LABELS[g]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="notes">Anything else agents should know?</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Recent renovations, tenants in place, HOA details…"
            />
          </div>
        </div>
      </fieldset>

      {state.error && (
        <p className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}

      <SubmitButton />
      <p className="text-center text-xs text-muted-foreground">
        By submitting you agree to be matched with local agents. We never sell
        your information.
      </p>
    </form>
  );
}
