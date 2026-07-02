import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SellerIntakeForm } from "@/components/seller-intake-form";

export const metadata = {
  title: "Get Matched — AgentMatch",
};

export default function SellPage() {
  return (
    <div className="bg-secondary/40 py-14">
      <div className="container max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            Tell us about your home
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Takes about two minutes. We&apos;ll instantly score every local
            agent against your property and goals, and show you your top three.
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent">
            <ShieldCheck className="h-4 w-4" />
            Your info is only shared with agents you choose to contact.
          </p>
        </div>
        <Card>
          <CardContent className="p-6 sm:p-10">
            <SellerIntakeForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
