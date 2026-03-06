import { Provider } from "@prisma/client";

import { IntegrationCard } from "@/components/integration-card";
import { NoticeBanner } from "@/components/notice-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { getUserConnections } from "@/lib/db/integrations";
import {
  getProviderOauthConfigurationMessage,
  isProviderOauthConfigured,
} from "@/lib/providers/configuration";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function IntegrationsPage({ searchParams }: Props) {
  const user = await requireUser();
  const query = (await searchParams) ?? {};
  const connections = await getUserConnections(user.id);
  const pandaDoc = connections.find((connection) => connection.provider === "PANDADOC");
  const quickBooks = connections.find(
    (connection) => connection.provider === "QUICKBOOKS",
  );
  const pandaDocConfigured = isProviderOauthConfigured(Provider.PANDADOC);
  const quickBooksConfigured = isProviderOauthConfigured(Provider.QUICKBOOKS);

  const notice = Array.isArray(query.notice) ? query.notice[0] : query.notice;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Integration settings
        </p>
        <h1 className="font-[var(--font-heading)] text-4xl font-semibold tracking-tight">
          Connect PandaDoc and QuickBooks Online
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Each provider is isolated behind its own adapter and token lifecycle. QuickBooks sync can run manually from the UI or via the secured cron endpoint.
        </p>
      </div>

      <NoticeBanner error={error} notice={notice} />

      <div className="grid gap-5 lg:grid-cols-2">
        <IntegrationCard
          connection={pandaDoc ?? null}
          provider={Provider.PANDADOC}
          providerConfigured={pandaDocConfigured}
          configurationMessage={getProviderOauthConfigurationMessage(
            Provider.PANDADOC,
          )}
        />
        <IntegrationCard
          connection={quickBooks ?? null}
          provider={Provider.QUICKBOOKS}
          providerConfigured={quickBooksConfigured}
          configurationMessage={getProviderOauthConfigurationMessage(
            Provider.QUICKBOOKS,
          )}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook endpoint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Configure PandaDoc webhooks to POST to `/api/webhooks/pandadoc`.</p>
          <p>
            If `PANDADOC_WEBHOOK_SHARED_SECRET` is set, PandaDoc deliveries must include
            the HMAC-SHA256 signature for the raw request body through the configured
            endpoint signature or the `x-pandadoc-signature` header.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
