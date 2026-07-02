import { BadgeCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AgentSignupForm } from "@/components/agent-signup-form";

export const metadata = {
  title: "Agent Signup — AgentMatch",
};

export default function AgentSignupPage() {
  return (
    <div className="bg-secondary/40 py-14">
      <div className="container max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            Create your agent profile
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Your profile data powers the matching algorithm. The more accurate
            your stats and specialties, the better your leads.
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent">
            <BadgeCheck className="h-4 w-4" />
            Free during the AgentMatch beta.
          </p>
        </div>
        <Card>
          <CardContent className="p-6 sm:p-10">
            <AgentSignupForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
