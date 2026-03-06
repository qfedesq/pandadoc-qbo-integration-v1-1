import type { ComponentProps } from "react";
import {
  FactoringEligibilityStatus,
  FactoringLifecycleStatus,
  FactoringTransactionStatus,
  IntegrationStatus,
  InvoiceStatus,
  OnChainExecutionStatus,
} from "@prisma/client";

import { Badge } from "@/components/ui/badge";

type StatusValue =
  | InvoiceStatus
  | IntegrationStatus
  | FactoringEligibilityStatus
  | FactoringLifecycleStatus
  | FactoringTransactionStatus
  | OnChainExecutionStatus;

const variants: Record<StatusValue, ComponentProps<typeof Badge>["variant"]> = {
  CONNECTED: "success",
  DISCONNECTED: "muted",
  ERROR: "destructive",
  ELIGIBLE: "success",
  INELIGIBLE: "destructive",
  IMPORTED: "muted",
  PENDING_TERMS_ACCEPTANCE: "warning",
  PENDING: "warning",
  FUNDED: "default",
  REPAYMENT_PENDING: "warning",
  DEFAULTED: "destructive",
  REPAID: "success",
  CANCELLED: "muted",
  NOT_STARTED: "muted",
  SIMULATED: "warning",
  SETTLED: "success",
  OPEN: "default",
  OVERDUE: "warning",
  PAID: "success",
  PARTIALLY_PAID: "warning",
};

export function StatusBadge({ status }: { status: StatusValue }) {
  return <Badge variant={variants[status]}>{status.replace(/_/g, " ")}</Badge>;
}
