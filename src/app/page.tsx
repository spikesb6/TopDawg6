import Link from "next/link";
import {
  BadgeCheck,
  BarChart3,
  Home,
  LineChart,
  MapPin,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy-950 via-navy-900 to-navy-800 py-24 text-white">
        <div className="container relative z-10 mx-auto max-w-3xl text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/90">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Matched on performance data, not advertising spend
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Selling your home?
            <br />
            Meet the <span className="text-emerald-400">right agent</span> in
            minutes.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/70">
            Tell us about your property once. AgentMatch scores every local
            agent on sales record, speed, price results, and specialty fit —
            then hands you a ranked shortlist of your top three.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/sell">
              <Button variant="accent" size="lg" className="min-w-52">
                <Home className="h-5 w-5" />
                Find My Agent — Free
              </Button>
            </Link>
            <Link href="/agents/signup">
              <Button
                variant="outline"
                size="lg"
                className="min-w-52 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Users className="h-5 w-5" />
                I&apos;m an Agent
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/50">
            No spam. No obligation. You choose who to talk to.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-primary">
              How AgentMatch works
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three steps from &ldquo;thinking about selling&rdquo; to
              interviewing top agents.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Home,
                title: "1. Tell us about your home",
                body: "Property type, condition, timeline, and what matters most to you — highest price, fastest sale, or an as-is exit.",
              },
              {
                icon: BarChart3,
                title: "2. We score every local agent",
                body: "Our algorithm rates agents 0–100 on service area, specialty fit, recent sales, days on market, and list-to-sale price ratio.",
              },
              {
                icon: BadgeCheck,
                title: "3. Interview your top 3",
                body: "See exactly why each agent matched, compare real stats side by side, and book interviews on your terms.",
              },
            ].map((step) => (
              <Card key={step.title} className="border-0 bg-secondary/60">
                <CardContent className="p-8">
                  <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <step.icon className="h-6 w-6" />
                  </span>
                  <h3 className="mb-2 text-lg font-semibold text-primary">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust stats */}
      <section className="border-y bg-secondary/40 py-16">
        <div className="container grid gap-8 text-center sm:grid-cols-3">
          {[
            {
              icon: MapPin,
              stat: "ZIP-level",
              label: "matching on true service areas",
            },
            {
              icon: Timer,
              stat: "9 factors",
              label: "scored per agent, 0–100",
            },
            {
              icon: LineChart,
              stat: "100% data",
              label: "rankings can't be bought",
            },
          ].map((item) => (
            <div key={item.stat} className="flex flex-col items-center">
              <item.icon className="mb-3 h-7 w-7 text-accent" />
              <p className="text-3xl font-bold text-primary">{item.stat}</p>
              <p className="text-sm text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agent CTA */}
      <section className="py-20">
        <div className="container">
          <Card className="overflow-hidden border-0 bg-navy-900 text-white">
            <CardContent className="flex flex-col items-center gap-8 p-10 md:flex-row md:justify-between md:p-14">
              <div className="max-w-xl">
                <h2 className="text-3xl font-bold tracking-tight">
                  Agents: leads that are actually ready to list.
                </h2>
                <p className="mt-3 text-white/70">
                  Every seller on AgentMatch has shared their property,
                  condition, timeline, and goals. You only see opportunities in
                  your ZIP codes that fit your specialties — scored so you know
                  which to call first.
                </p>
                <ul className="mt-5 space-y-2 text-sm text-white/80">
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Qualified intent, not cold traffic
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Matched on your real performance data
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Built-in pipeline: new → contacted → won
                  </li>
                </ul>
              </div>
              <Link href="/agents/signup" className="shrink-0">
                <Button variant="accent" size="lg">
                  Create Agent Profile
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
