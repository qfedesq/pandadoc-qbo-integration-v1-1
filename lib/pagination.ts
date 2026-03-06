export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export function clampPageSize(pageSize = DEFAULT_PAGE_SIZE) {
  return Math.max(1, Math.min(pageSize, MAX_PAGE_SIZE));
}

export function getPagination(input?: {
  page?: number;
  pageSize?: number;
}) {
  const pageSize = clampPageSize(input?.pageSize);
  const page = Math.max(1, input?.page ?? 1);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}
