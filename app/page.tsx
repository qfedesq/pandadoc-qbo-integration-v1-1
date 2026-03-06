import Link from "next/link";
import { ArrowRight, DatabaseZap, ShieldCheck, Workflow } from "lucide-react";

import { AppBrand } from "@/components/app-brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    title: "QuickBooks mock or OAuth",
    description:
      "Run the demo fully in mock mode out of the box, or swap in live OAuth credentials later without changing the product flow.",
    icon: ShieldCheck,
  },
  {
    title: "Invoice normalization",
    description:
      "Outstanding QuickBooks invoices are normalized into a stable internal model ready for future workflows.",
    icon: DatabaseZap,
  },
  {
    title: "Pool and operator views",
    description:
      "Track seller disbursements, pool utilization, accrued yield, and protocol fee balances across dedicated dashboards.",
    icon: Workflow,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="container py-12 md:py-20">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-7">
            <AppBrand className="w-fit" />
            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-white/12 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                PandaDoc ↔ QuickBooks Online
              </span>
              <h1 className="max-w-4xl font-[var(--font-heading)] text-5xl font-semibold tracking-tight text-balance text-white md:text-6xl">
                Turn QuickBooks receivables into a Protofire-branded factoring marketplace node.
              </h1>
              <p className="max-w-3xl text-lg text-slate-300">
                A production-minded workspace for invoice sync, premium seller UX,
                instant capital withdrawal, pool accounting, and repayment
                simulation across the full factoring loop.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/login">
                  Open dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/factoring-dashboard">Go to factoring dashboard</Link>
              </Button>
            </div>
          </div>
          <Card className="protofire-hero relative overflow-hidden border border-white/12">
            <div className="protofire-wave absolute inset-0 opacity-35" />
            <CardContent className="relative space-y-4 p-8">
              <div className="rounded-[1.25rem] border border-white/12 bg-white/6 p-5 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                  Current milestone
                </p>
                <h2 className="mt-3 font-[var(--font-heading)] text-2xl font-semibold text-white">
                  Connect. Import. Withdraw. Track. Repay.
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  The model supports seller disbursement in demo USDC, operator fee
                  booking, pool yield tracking, audit trails, and a clean path
                  toward live infrastructure later.
                </p>
              </div>
              <div className="grid gap-3">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-[1.25rem] border border-white/12 bg-white/6 p-5 backdrop-blur"
                  >
                    <feature.icon className="h-5 w-5 text-primary" />
                    <h3 className="mt-3 font-semibold text-white">{feature.title}</h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
