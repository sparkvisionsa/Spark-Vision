const DAY_MS = 24 * 60 * 60 * 1000;

export function parseProjectArchiveDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? new Date(value) : null;
  }
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function addYears(value: Date, years: number): Date {
  const result = new Date(value);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

export function resolveProjectArchiveDates(project: {
  deletedAt?: unknown;
  companyRestoreUntil?: unknown;
  purgeAt?: unknown;
}) {
  const deletedAt = parseProjectArchiveDate(project.deletedAt);
  return {
    deletedAt,
    companyRestoreUntil:
      parseProjectArchiveDate(project.companyRestoreUntil) ??
      (deletedAt ? addDays(deletedAt, 30) : null),
    purgeAt:
      parseProjectArchiveDate(project.purgeAt) ??
      (deletedAt ? addYears(deletedAt, 1) : null),
  };
}
