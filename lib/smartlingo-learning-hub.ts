export function vocabularyLibraryPage<T>(items: readonly T[], requestedPage: number, pageSize = 20) {
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(pageCount, Math.max(1, Math.floor(requestedPage) || 1));
  return {
    page,
    pageCount,
    start: items.length ? (page - 1) * size + 1 : 0,
    end: Math.min(page * size, items.length),
    items: items.slice((page - 1) * size, page * size),
  };
}
