// Pure display formatting helpers (no state, no side effects).

export function fmtRelative(iso?: string | number): string {
  if (iso === undefined || iso === null || iso === "") return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(iso).toLocaleDateString();
}

/** Compact count formatting: 1234 → "1.2k", 2_500_000 → "2.5m". */
export function fmtCount(n?: number): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "0";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}m`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}
