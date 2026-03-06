import Link from "next/link";

import { Button } from "@/components/ui/button";

function buildPageHref(
  pathname: string,
  page: number,
  searchParams: Record<string, string | number | boolean | undefined>,
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value === undefined || value === "" || value === false) {
      return;
    }

    params.set(key, String(value));
  });

  if (page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function QueryPagination({
  pathname,
  page,
  pageSize,
  totalItems,
  searchParams,
  label = "results",
}: {
  pathname: string;
  page: number;
  pageSize: number;
  totalItems: number;
  searchParams: Record<string, string | number | boolean | undefined>;
  label?: string;
}) {
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between rounded-[1.25rem] border border-border/70 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
        <span>
          Showing {start}-{end} of {totalItems} {label}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-white/5 px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <span>
        Showing {start}-{end} of {totalItems} {label}
      </span>
      <div className="flex items-center gap-2">
        {currentPage <= 1 ? (
          <Button variant="outline" size="sm" disabled type="button">
            Previous
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={buildPageHref(pathname, currentPage - 1, searchParams)}>
              Previous
            </Link>
          </Button>
        )}
        <span className="min-w-20 text-center text-xs font-semibold uppercase tracking-[0.18em]">
          Page {currentPage} / {totalPages}
        </span>
        {currentPage >= totalPages ? (
          <Button variant="outline" size="sm" disabled type="button">
            Next
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={buildPageHref(pathname, currentPage + 1, searchParams)}>
              Next
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
