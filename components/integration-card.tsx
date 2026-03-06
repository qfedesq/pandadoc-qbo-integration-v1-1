import { Provider, type IntegrationConnection } from "@prisma/client";

import { CsrfHiddenInput } from "@/components/csrf-hidden-input";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isQuickBooksMockMode } from "@/lib/env";
import { getQuickBooksConnectionDisplayName } from "@/lib/providers/quickbooks/mock";
import { formatDate } from "@/lib/utils";

type Connection = IntegrationConnection & {
  quickBooksCompany?: {
    companyName: string | null;
    realmId: string;
  } | null;
};

export function IntegrationCard({
  provider,
  connection,
  providerConfigured,
  configurationMessage,
}: {
  provider: Provider;
  connection: Connection | null;
  providerConfigured: boolean;
  configurationMessage: string;
}) {
  const isConnected = connection?.status === "CONNECTED";
  const accountName =
    provider === "QUICKBOOKS"
      ? getQuickBooksConnectionDisplayName(connection)
      : (connection?.externalAccountName ?? null);
  const connectHref =
    provider === "PANDADOC"
      ? "/api/oauth/pandadoc/connect"
      : "/api/oauth/quickbooks/connect";

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>
              {provider === "PANDADOC" ? "PandaDoc" : "QuickBooks Online"}
            </CardTitle>
            <CardDescription>
              {provider === "PANDADOC"
                ? "Connect the workspace where invoice documents and financing actions stay inside PandaDoc."
                : "Connect the accounting system used to import unpaid invoices and refresh repayment status."}
            </CardDescription>
          </div>
          <StatusBadge status={connection?.status ?? "DISCONNECTED"} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Account:{" "}
          <span className="font-medium text-foreground">
            {accountName ?? "Not connected"}
          </span>
        </p>
        {provider === "QUICKBOOKS" ? (
          <p>
            Realm ID:{" "}
            <span className="font-medium text-foreground">
              {connection?.externalAccountId ?? "—"}
            </span>
          </p>
        ) : null}
        <p>
          Last sync:{" "}
          <span className="font-medium text-foreground">
            {connection?.lastSyncAt
              ? formatDate(connection.lastSyncAt)
              : "Never"}
          </span>
        </p>
        {connection?.lastError ? (
          <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-rose-100">
            {connection.lastError}
          </p>
        ) : null}
        {!providerConfigured ? (
          <p className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-amber-50">
            {configurationMessage}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="justify-between">
        {providerConfigured ? (
          <form action={connectHref} method="post">
            <CsrfHiddenInput />
            <input type="hidden" name="redirectTo" value="/integrations" />
            <Button
              type="submit"
              variant={isConnected ? "secondary" : "default"}
            >
              {isConnected
                ? "Reconnect"
                : provider === "QUICKBOOKS" && isQuickBooksMockMode()
                  ? "Connect demo company"
                  : "Connect"}
            </Button>
          </form>
        ) : (
          <Button type="button" variant="outline" disabled>
            Credentials pending
          </Button>
        )}
        {connection ? (
          <form
            action={`/api/integrations/${provider.toLowerCase()}/disconnect`}
            method="post"
          >
            <CsrfHiddenInput />
            <Button type="submit" variant="outline">
              Disconnect
            </Button>
          </form>
        ) : null}
      </CardFooter>
    </Card>
  );
}
