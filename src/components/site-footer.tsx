import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t bg-navy-900 py-12 text-white">
      <div className="container grid gap-8 md:grid-cols-3">
        <div>
          <p className="text-lg font-bold">
            Agent<span className="text-emerald-400">Match</span>
          </p>
          <p className="mt-2 max-w-xs text-sm text-white/60">
            The smarter way to find the right listing agent — matched on real
            performance, not ads.
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold text-white/90">Homeowners</p>
          <ul className="space-y-2 text-white/60">
            <li>
              <Link href="/sell" className="hover:text-white">
                Get matched with agents
              </Link>
            </li>
            <li>
              <Link href="/dashboard/seller" className="hover:text-white">
                Seller dashboard
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold text-white/90">Agents</p>
          <ul className="space-y-2 text-white/60">
            <li>
              <Link href="/agents/signup" className="hover:text-white">
                Join as an agent
              </Link>
            </li>
            <li>
              <Link href="/dashboard/agent" className="hover:text-white">
                Lead dashboard
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="container mt-10 border-t border-white/10 pt-6 text-xs text-white/40">
        © {new Date().getFullYear()} AgentMatch. MVP demo — not a licensed
        brokerage.
      </div>
    </footer>
  );
}
