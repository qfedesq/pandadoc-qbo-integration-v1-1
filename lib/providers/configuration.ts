import { Provider } from "@prisma/client";

import {
  hasPandaDocOauthConfig,
  hasQuickBooksOauthConfig,
  isQuickBooksMockMode,
} from "@/lib/env";

export function isProviderOauthConfigured(provider: Provider) {
  if (provider === Provider.PANDADOC) {
    return hasPandaDocOauthConfig();
  }

  return isQuickBooksMockMode() || hasQuickBooksOauthConfig();
}

export function getProviderOauthConfigurationMessage(provider: Provider) {
  if (provider === Provider.PANDADOC) {
    return "PandaDoc sign-in will be available after this deployment has valid PANDADOC_CLIENT_ID and PANDADOC_CLIENT_SECRET values.";
  }

  if (isQuickBooksMockMode()) {
    return "QuickBooks is running in mock mode. Connect the seeded demo company to import realistic invoices without external credentials.";
  }

  return "QuickBooks sign-in will be available after this deployment has valid QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET values.";
}
