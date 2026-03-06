import { InvoiceStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function InvoiceFilters({
  search,
  status,
  overdueOnly,
}: {
  search?: string;
  status?: string;
  overdueOnly?: boolean;
}) {
  return (
    <form
      className="protofire-panel grid gap-3 rounded-[1.5rem] border border-border/70 p-4 md:grid-cols-[2fr_1fr_auto_auto]"
      role="search"
    >
      <Input
        aria-label="Search invoices"
        name="q"
        defaultValue={search}
        placeholder="Search by invoice ID, number, or counterparty"
      />
      <Select
        aria-label="Filter by invoice status"
        name="status"
        defaultValue={status ?? "ALL"}
      >
        <option value="ALL">All statuses</option>
        {Object.values(InvoiceStatus).map((value) => (
          <option key={value} value={value}>
            {value.replace(/_/g, " ")}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 text-sm font-medium text-foreground">
        <input
          defaultChecked={overdueOnly}
          name="overdue"
          type="checkbox"
          value="true"
        />
        Overdue only
      </label>
      <Button type="submit" variant="secondary">
        Apply filters
      </Button>
    </form>
  );
}
