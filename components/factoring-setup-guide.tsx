import { Provider, type IntegrationConnection } from "@prisma/client";

import { SyncButton } from "@/components/sync-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    provider === Provider.PANDADOC ? "PandaDoc" : "QuickBooks Online";

  if (!configured) {
    return (
      <Button type="button" variant="outline" disabled>
        {label} credentials pending
      </Button>
    );
  }

  return (
    <form action={action} method="post">
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
    <div className="rounded-[1.35rem] border border-white/12 bg-white/6 p-5">
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
  const bridgeReady = pandaDocConnected && quickBooksConnected;
  const redirectTo = "/factoring-dashboard";

  return (
    <Card className="protofire-hero relative overflow-hidden border border-white/12">
      <CardHeader className="relative">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
              Guided setup
            </p>
            <CardTitle className="text-white">
              Connect both systems without manual API setup
            </CardTitle>
            <p className="max-w-3xl text-sm text-slate-300">
              A non-technical user only needs to authorize PandaDoc and QuickBooks with their normal credentials. The app handles OAuth, stores tokens server-side, and links both systems through the same dashboard account.
            </p>
          </div>
          <div className="w-fit rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-slate-100">
            {bridgeReady
              ? "Bridge ready: both accounts are connected"
              : "Finish both authorizations to activate the bridge"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="grid gap-4 xl:grid-cols-3">
          <SetupStep
            step="Step 1"
            title="Authorize PandaDoc"
            description="Use the normal PandaDoc sign-in flow and let the app store the workspace connection."
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
            title="Authorize QuickBooks"
            description="Use the QuickBooks company login flow so outstanding invoices can be synced automatically."
            status={quickBooksConnected ? "CONNECTED" : "DISCONNECTED"}
            detail={
              quickBooksConnected
                ? `Connected as ${quickBooksConnection?.externalAccountName ?? "QuickBooks company"}.`
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
            title="Sync and work invoices"
            description="Once both providers are connected, refresh outstanding invoices and send selected records into PandaDoc."
            status={quickBooksConnected ? "CONNECTED" : "DISCONNECTED"}
            detail={
              quickBooksConnected
                ? "Trigger a sync now or wait for the configured periodic refresh window."
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
