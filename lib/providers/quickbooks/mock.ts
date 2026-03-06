import mockOutstandingInvoices from "@/mock-data/quickbooks/outstanding-invoices-response.json";

import {
  quickBooksQueryResponseSchema,
  type QuickBooksInvoice,
} from "./schemas";

const parsedMockInvoices = quickBooksQueryResponseSchema.parse(
  mockOutstandingInvoices,
);

export function getMockQuickBooksCompanyInfo() {
  return {
    realmId: "mock-realm-9130357992222222",
    companyName: "Protofire SaaS Demo LLC",
    country: "US",
    currency: "USD",
  };
}

export function getMockQuickBooksInvoices() {
  return [...(parsedMockInvoices.QueryResponse.Invoice ?? [])] as QuickBooksInvoice[];
}
