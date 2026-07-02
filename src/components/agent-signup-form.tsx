"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitAgentSignup, type FormState } from "@/app/actions";
import { SPECIALTIES, SPECIALTY_LABELS } from "@/lib/types";

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
      {pending ? "Creating your profile…" : "Create My Agent Profile"}
      {!pending && <ArrowRight className="h-5 w-5" />}
    </Button>
  );
}

export function AgentSignupForm() {
  const [state, formAction] = useFormState<FormState, FormData>(
    submitAgentSignup,
    {}
  );

  return (
    <form action={formAction} className="space-y-8">
      {/* Identity */}
      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-semibold text-primary">
          Your details
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name *</Label>
            <Input id="full_name" name="full_name" placeholder="Alex Rivera" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brokerage">Brokerage *</Label>
            <Input id="brokerage" name="brokerage" placeholder="Compass" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" name="email" type="email" placeholder="alex@brokerage.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone *</Label>
            <Input id="phone" name="phone" type="tel" placeholder="(512) 555-0100" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="license_number">License number *</Label>
            <Input id="license_number" name="license_number" placeholder="TX-123456" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="photo_url">Profile photo URL</Label>
            <Input id="photo_url" name="photo_url" type="url" placeholder="https://…/headshot.jpg" />
          </div>
        </div>
      </fieldset>

      {/* Coverage & performance */}
      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-semibold text-primary">
          Coverage &amp; track record
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="service_zip_codes">Service ZIP codes *</Label>
            <Input
              id="service_zip_codes"
              name="service_zip_codes"
              placeholder="78701, 78704, 78745"
              required
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. You&apos;ll only be matched to sellers in these ZIPs.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="years_experience">Years of experience</Label>
            <Input id="years_experience" name="years_experience" type="number" min={0} max={60} placeholder="8" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="total_homes_sold">Total homes sold</Label>
            <Input id="total_homes_sold" name="total_homes_sold" type="number" min={0} placeholder="150" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="homes_sold_last_12mo">Homes sold, last 12 months</Label>
            <Input id="homes_sold_last_12mo" name="homes_sold_last_12mo" type="number" min={0} placeholder="24" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avg_days_on_market">Average days on market</Label>
            <Input id="avg_days_on_market" name="avg_days_on_market" type="number" min={1} placeholder="21" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="avg_list_to_sale_ratio">
              Average list-to-sale price ratio
            </Label>
            <Input
              id="avg_list_to_sale_ratio"
              name="avg_list_to_sale_ratio"
              type="number"
              min={0.5}
              max={1.5}
              step={0.01}
              placeholder="0.98"
            />
            <p className="text-xs text-muted-foreground">
              e.g. 0.98 = your listings sell at 98% of list price on average.
            </p>
          </div>
        </div>
      </fieldset>

      {/* Specialties */}
      <fieldset className="space-y-3">
        <legend className="mb-1 text-lg font-semibold text-primary">
          Specialties
        </legend>
        <p className="text-sm text-muted-foreground">
          Pick everything that applies — this drives your match quality.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SPECIALTIES.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors hover:bg-secondary has-[:checked]:border-accent has-[:checked]:bg-accent/5"
            >
              <input
                type="checkbox"
                name="specialties"
                value={s}
                className="h-4 w-4 rounded accent-[#10b981]"
              />
              {SPECIALTY_LABELS[s]}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Bio */}
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-lg font-semibold text-primary">Bio</legend>
        <Textarea
          id="bio"
          name="bio"
          rows={4}
          placeholder="Tell sellers what makes you the right agent for them…"
        />
      </fieldset>

      {state.error && (
        <p className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
