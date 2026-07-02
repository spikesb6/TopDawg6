import Link from "next/link";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSessionIds, logout } from "@/app/actions";

export async function SiteHeader() {
  const { sellerId, agentId } = await getSessionIds();
  const loggedIn = Boolean(sellerId || agentId);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Home className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold tracking-tight text-primary">
            Agent<span className="text-accent">Match</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/sell" className="transition-colors hover:text-foreground">
            For Sellers
          </Link>
          <Link
            href="/agents/signup"
            className="transition-colors hover:text-foreground"
          >
            For Agents
          </Link>
          {sellerId && (
            <Link
              href="/dashboard/seller"
              className="transition-colors hover:text-foreground"
            >
              My Dashboard
            </Link>
          )}
          {agentId && (
            <Link
              href="/dashboard/agent"
              className="transition-colors hover:text-foreground"
            >
              My Leads
            </Link>
          )}
          <Link href="/admin" className="transition-colors hover:text-foreground">
            Admin
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {loggedIn ? (
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
          )}
          <Link href="/sell">
            <Button variant="accent" size="sm">
              Get Matched
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
