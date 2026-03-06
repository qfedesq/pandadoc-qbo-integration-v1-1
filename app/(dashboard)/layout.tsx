import Link from "next/link";

import { AppBrand } from "@/components/app-brand";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-slate-950/60 backdrop-blur">
        <div className="container flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <AppBrand href="/" compact />
            <p className="max-w-xl text-sm text-muted-foreground">
              Secure OAuth, QuickBooks invoice sync, Arena StaFi-ready settlement simulation, and PandaDoc factoring operations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex items-center gap-2 rounded-full border border-white/12 bg-white/5 p-1">
              <Button asChild variant="ghost" size="sm">
                <Link href="/factoring-dashboard">Seller</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/invoices">Invoices</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/transactions">Transactions</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/capital-pool">Capital pool</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/operator">Operator</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/integrations">Integrations</Link>
              </Button>
            </nav>
            <div className="text-sm text-muted-foreground">{user.email}</div>
            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
