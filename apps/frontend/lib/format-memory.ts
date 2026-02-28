export const normalizeMemoryKb = (
  raw: number | null | undefined,
): number | null => {
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return 0;

  // Legacy rows may contain bytes in memory_kb column.
  if (value >= 1024 * 1024) {
    return value / 1024;
  }
  return value;
};

export const formatMemoryKb = (
  raw: number | null | undefined,
  fallback = "-",
): string => {
  const normalized = normalizeMemoryKb(raw);
  if (normalized === null) return fallback;
  const digits = normalized >= 100 ? 0 : 1;
  return `${normalized.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} KB`;
};
