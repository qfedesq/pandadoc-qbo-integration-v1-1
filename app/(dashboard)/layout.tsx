import { UserRole } from "@prisma/client";
import Link from "next/link";

import { AppBrand } from "@/components/app-brand";
import { CsrfHiddenInput } from "@/components/csrf-hidden-input";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getEffectiveUserRole } from "@/lib/auth/authorization";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const role = getEffectiveUserRole(user);
  const isOperatorView = role === UserRole.OPERATOR || role === UserRole.ADMIN;
  const navigationItems = [
    { href: "/factoring-dashboard", label: "Seller" },
    { href: "/invoices", label: "Invoices" },
    { href: "/transactions", label: "Transactions" },
    ...(isOperatorView
      ? [
          { href: "/capital-pool", label: "Capital pool" },
          { href: "/operator", label: "Operator" },
        ]
      : []),
    { href: "/integrations", label: "Integrations" },
  ];
  const roleLabel =
    role === UserRole.ADMIN
      ? "Admin"
      : role === UserRole.OPERATOR
        ? "Operator"
        : "Seller";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-slate-950/60 backdrop-blur">
        <div className="container flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <AppBrand href="/" compact />
            <p className="max-w-xl text-sm text-muted-foreground">
              Connect PandaDoc and QuickBooks, import invoices, and move from
              unpaid receivables to funded advances in one workflow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="border-white/12 flex items-center gap-2 rounded-full border bg-white/5 p-1">
              {navigationItems.map((item) => (
                <Button key={item.href} asChild variant="ghost" size="sm">
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </nav>
            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
              {roleLabel}
            </div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
            <form action="/api/auth/logout" method="post">
              <CsrfHiddenInput />
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
