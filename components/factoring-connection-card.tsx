import { Provider, type IntegrationConnection } from "@prisma/client";
import Link from "next/link";

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
import { formatDateTime } from "@/lib/utils";

type Props = {
  provider: Provider;
  label: string;
  description: string;
  connection: IntegrationConnection | null;
  metadataLabel: string;
  metadataValue: string;
  providerConfigured: boolean;
  configurationMessage: string;
};

export function FactoringConnectionCard({
  provider,
  label,
  description,
  connection,
  metadataLabel,
  metadataValue,
  providerConfigured,
  configurationMessage,
}: Props) {
  const isConnected = connection?.status === "CONNECTED";
  const connectHref =
    provider === Provider.PANDADOC
      ? "/api/oauth/pandadoc/connect"
      : "/api/oauth/quickbooks/connect";

  return (
    <Card className="h-full">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>{label}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <StatusBadge status={connection?.status ?? "DISCONNECTED"} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">
            Account
          </p>
          <p className="mt-1 font-medium text-foreground">
            {connection?.externalAccountName ?? "Not connected"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">
            {metadataLabel}
          </p>
          <p className="mt-1 font-medium text-foreground">{metadataValue}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">
            Last sync
          </p>
          <p className="mt-1 font-medium text-foreground">
            {formatDateTime(connection?.lastSyncAt)}
          </p>
        </div>
        {connection?.lastError ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-rose-100">
            {connection.lastError}
          </div>
        ) : null}
        {!providerConfigured ? (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-amber-50">
            {configurationMessage}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 sm:flex-row">
        {providerConfigured ? (
          <form action={connectHref} method="post">
            <input type="hidden" name="redirectTo" value="/factoring-dashboard" />
            <Button type="submit" variant={isConnected ? "secondary" : "default"}>
              {isConnected ? "Reconnect here" : "Connect here"}
            </Button>
          </form>
        ) : (
          <Button type="button" variant="outline" disabled>
            Provider credentials pending
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/integrations">
            {isConnected ? "Integration settings" : "Open setup settings"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
