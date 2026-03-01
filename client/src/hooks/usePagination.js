import { useState, useMemo } from 'react';

export function usePagination(data, perPage) {
  const [page, setPage] = useState(1);

  const startIndex = (page - 1) * perPage;
  const totalPages = Math.ceil((data?.length || 0) / perPage);

  const paginatedData = useMemo(() => {
    return (data || []).slice(startIndex, startIndex + perPage);
  }, [data, page, perPage]);

  return { page, setPage, paginatedData, totalPages, startIndex };
}
