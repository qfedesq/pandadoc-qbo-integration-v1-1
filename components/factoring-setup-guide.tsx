import { Provider, type IntegrationConnection } from "@prisma/client";

import { CsrfHiddenInput } from "@/components/csrf-hidden-input";
import { SyncButton } from "@/components/sync-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isQuickBooksMockMode } from "@/lib/env";
import { getQuickBooksConnectionDisplayName } from "@/lib/providers/quickbooks/mock";

function ProviderConnectAction({
  provider,
  configured,
  redirectTo,
  connected,
}: {
  provider: Provider;
  configured: boolean;
  redirectTo: string;
  connected: boolean;
}) {
  const action =
    provider === Provider.PANDADOC
      ? "/api/oauth/pandadoc/connect"
      : "/api/oauth/quickbooks/connect";
  const label =
    provider === Provider.PANDADOC
      ? "workspace"
      : isQuickBooksMockMode()
        ? "demo company"
        : "company";
  const providerLabel =
    provider === Provider.PANDADOC ? "PandaDoc" : "QuickBooks";

  if (!configured) {
    return (
      <Button type="button" variant="outline" disabled>
        {providerLabel} credentials pending
      </Button>
    );
  }

  return (
    <form action={action} method="post">
      <CsrfHiddenInput />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Button type="submit" variant={connected ? "secondary" : "default"}>
        {connected ? `Reconnect ${label}` : `Connect ${label}`}
      </Button>
    </form>
  );
}

function SetupStep({
  step,
  title,
  description,
  status,
  action,
  detail,
}: {
  step: string;
  title: string;
  description: string;
  status: "CONNECTED" | "DISCONNECTED";
  action: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="border-white/12 bg-white/6 rounded-[1.35rem] border p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
            {step}
          </p>
          <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm text-slate-300">{description}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="mt-4 text-sm text-slate-200">{detail}</p>
      <div className="mt-5">{action}</div>
    </div>
  );
}

export function FactoringSetupGuide({
  pandaDocConnection,
  quickBooksConnection,
  pandaDocConfigured,
  quickBooksConfigured,
  providerMessages,
}: {
  pandaDocConnection: IntegrationConnection | null;
  quickBooksConnection: IntegrationConnection | null;
  pandaDocConfigured: boolean;
  quickBooksConfigured: boolean;
  providerMessages: {
    pandaDoc: string;
    quickBooks: string;
  };
}) {
  const pandaDocConnected = pandaDocConnection?.status === "CONNECTED";
  const quickBooksConnected = quickBooksConnection?.status === "CONNECTED";
  const quickBooksAccountName =
    getQuickBooksConnectionDisplayName(quickBooksConnection);
  const bridgeReady = pandaDocConnected && quickBooksConnected;
  const redirectTo = "/factoring-dashboard";

  return (
    <Card className="protofire-hero border-white/12 relative overflow-hidden border">
      <CardHeader className="relative">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
              Guided setup
            </p>
            <CardTitle className="text-white">
              Activate working capital in three steps
            </CardTitle>
            <p className="max-w-3xl text-sm text-slate-300">
              A finance team only needs to connect PandaDoc and QuickBooks with
              the usual sign-in flows. Once both are connected, outstanding
              invoices can be imported and turned into capital offers inside the
              same workspace.
            </p>
          </div>
          <div className="border-white/12 bg-white/8 w-fit rounded-full border px-4 py-2 text-sm font-medium text-slate-100">
            {bridgeReady
              ? "Ready: invoices can be imported and funded"
              : "Complete both connections to unlock invoice funding"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="grid gap-4 xl:grid-cols-3">
          <SetupStep
            step="Step 1"
            title="Connect PandaDoc workspace"
            description="Authorize the PandaDoc workspace where invoice documents and financing actions will live."
            status={pandaDocConnected ? "CONNECTED" : "DISCONNECTED"}
            detail={
              pandaDocConnected
                ? `Connected as ${pandaDocConnection?.externalAccountName ?? "PandaDoc workspace"}.`
                : providerMessages.pandaDoc
            }
            action={
              <ProviderConnectAction
                provider={Provider.PANDADOC}
                configured={pandaDocConfigured}
                redirectTo={redirectTo}
                connected={pandaDocConnected}
              />
            }
          />
          <SetupStep
            step="Step 2"
            title="Connect QuickBooks company"
            description="Authorize the accounting source of truth so open invoices can be imported automatically."
            status={quickBooksConnected ? "CONNECTED" : "DISCONNECTED"}
            detail={
              quickBooksConnected
                ? `Connected as ${quickBooksAccountName ?? "QuickBooks company"}.`
                : providerMessages.quickBooks
            }
            action={
              <ProviderConnectAction
                provider={Provider.QUICKBOOKS}
                configured={quickBooksConfigured}
                redirectTo={redirectTo}
                connected={quickBooksConnected}
              />
            }
          />
          <SetupStep
            step="Step 3"
            title="Import invoices and offer capital"
            description="Refresh outstanding invoices, review eligibility, and start the Withdraw Capital flow on any approved invoice."
            status={quickBooksConnected ? "CONNECTED" : "DISCONNECTED"}
            detail={
              quickBooksConnected
                ? "Sync now to refresh invoices and surface new capital offers."
                : "QuickBooks must be connected before invoice refresh can start."
            }
            action={
              <SyncButton
                disabled={!quickBooksConnected}
                payload={
                  quickBooksConnection
                    ? { connectionId: quickBooksConnection.id, force: true }
                    : undefined
                }
              />
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
