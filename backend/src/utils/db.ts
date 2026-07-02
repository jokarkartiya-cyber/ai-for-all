export function parseJsonField<T = Record<string, unknown>>(val: unknown): T {
  if (!val) return {} as T;
  if (typeof val === "string") {
    try { return JSON.parse(val) as T; } catch { return {} as T; }
  }
  return val as T;
}

export function toSqliteBool(val: boolean | number): number {
  return val ? 1 : 0;
}

export function fromSqliteBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  if (typeof val === "string") return val === "1" || val === "true";
  return false;
}
