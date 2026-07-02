"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginWithEmail, type FormState } from "@/app/actions";
import { cn } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

/**
 * Mock authentication: looks up an existing profile by email and sets a
 * session cookie. Replace with Supabase Auth for production.
 */
export function LoginForm() {
  const [role, setRole] = useState<"seller" | "agent">("seller");
  const [state, formAction] = useFormState<FormState, FormData>(
    loginWithEmail,
    {}
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid grid-cols-2 rounded-lg bg-secondary p-1 text-sm font-medium">
        {(["seller", "agent"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={cn(
              "rounded-md py-2 transition-colors",
              role === r
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {r === "seller" ? "I'm a Homeowner" : "I'm an Agent"}
          </button>
        ))}
      </div>
      <input type="hidden" name="role" value={role} />

      <div className="space-y-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={
            role === "seller"
              ? "karen.mitchell@example.com"
              : "maria.vasquez@example.com"
          }
          required
        />
        <p className="text-xs text-muted-foreground">
          Demo auth: enter the email you used at signup, or any seed-data
          email shown in the placeholder.
        </p>
      </div>

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
