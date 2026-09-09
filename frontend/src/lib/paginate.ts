export interface Page<T> {
  /** Total number of pages (at least 1, even when empty). */
  pageCount: number;
  /** The requested page clamped into range. */
  current: number;
  /** Index of the first item on this page. */
  start: number;
  /** The items on this page. */
  slice: T[];
}

/** Split `items` into fixed-size pages and return the requested one, clamped. */
export function paginate<T>(items: T[], page: number, size: number): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(0, Math.trunc(page) || 0), pageCount - 1);
  const start = current * size;
  return { pageCount, current, start, slice: items.slice(start, start + size) };
}
