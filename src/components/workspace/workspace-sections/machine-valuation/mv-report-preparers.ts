import type { MvReportTeamMember } from "./types";

export const MV_REPORT_MANAGER_ROLE =
  "الإدارة التنفيذية وتعميد ومراجعة المخرجات النهائية";
export const MV_REPORT_PREPARER_ROLE = "إعداد التقرير";
export const MV_REPORT_INSPECTION_ROLE = "المعاينة";

export type MvReportPreparerOption = {
  id: string;
  name: string;
  jobTitle: string;
  membershipNo: string;
  signatureImageDataUrl: string;
  memberRole: string;
  isCompanyAdmin: boolean;
};

function clean(value: unknown, maxLength = 500): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeReportPreparerOptions(input: unknown): MvReportPreparerOption[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const rows: MvReportPreparerOption[] = [];
  for (const value of input) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const id = clean(row.id, 100);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const memberRole = clean(row.memberRole, 50);
    rows.push({
      id,
      name: clean(row.name, 200),
      jobTitle: clean(row.jobTitle ?? row.roleLabel, 200),
      membershipNo: clean(row.membershipNo, 100),
      signatureImageDataUrl:
        typeof row.signatureImageDataUrl === "string" &&
        row.signatureImageDataUrl.startsWith("data:image/")
          ? row.signatureImageDataUrl
          : "",
      memberRole,
      isCompanyAdmin: row.isCompanyAdmin === true || memberRole === "company_admin",
    });
  }
  return rows.sort((a, b) => Number(b.isCompanyAdmin) - Number(a.isCompanyAdmin));
}

export function defaultReportPreparerRole(
  isCompanyAdmin: boolean,
  nonManagerIndex: number,
): string {
  if (isCompanyAdmin) return MV_REPORT_MANAGER_ROLE;
  return nonManagerIndex === 0 ? MV_REPORT_PREPARER_ROLE : MV_REPORT_INSPECTION_ROLE;
}

function sanitizeStoredTeam(input: unknown): MvReportTeamMember[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const rows: MvReportTeamMember[] = [];
  for (const value of input) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const id = clean(row.id, 100);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      name: clean(row.name, 200),
      title: clean(row.title, 200),
      membershipNo: clean(row.membershipNo, 100),
      role: clean(row.role, 500),
    });
    if (rows.length >= 12) break;
  }
  return rows;
}

/**
 * Keeps the project selection stable while refreshing report identity fields
 * from company settings. The company manager is always the first, fixed row.
 */
export function normalizeReportTeam(
  input: unknown,
  options: MvReportPreparerOption[],
): MvReportTeamMember[] {
  const stored = sanitizeStoredTeam(input);
  if (options.length === 0) return stored;

  const optionById = new Map(options.map((option) => [option.id, option]));
  const manager = options.find((option) => option.isCompanyAdmin);
  const ordered = manager
    ? [
        stored.find((row) => row.id === manager.id) ?? {
          id: manager.id,
          name: manager.name,
          title: manager.jobTitle,
          membershipNo: manager.membershipNo,
          role: MV_REPORT_MANAGER_ROLE,
        },
        ...stored.filter((row) => row.id !== manager.id),
      ]
    : stored;

  let nonManagerIndex = 0;
  return ordered.slice(0, 12).map((row) => {
    const option = optionById.get(row.id);
    const isManager = option?.isCompanyAdmin === true || row.id === manager?.id;
    const defaultRole = defaultReportPreparerRole(isManager, nonManagerIndex);
    if (!isManager) nonManagerIndex += 1;
    return {
      id: row.id,
      name: option?.name ?? clean(row.name, 200),
      title: option?.jobTitle ?? clean(row.title, 200),
      membershipNo: option?.membershipNo ?? clean(row.membershipNo, 100),
      role: clean(row.role, 500) || defaultRole,
    };
  });
}

export function reportTeamMemberFromOption(
  option: MvReportPreparerOption,
  currentTeam: MvReportTeamMember[],
  allOptions: MvReportPreparerOption[],
): MvReportTeamMember {
  const nonManagerCount = currentTeam.filter(
    (row) => !allOptions.find((candidate) => candidate.id === row.id)?.isCompanyAdmin,
  ).length;
  return {
    id: option.id,
    name: option.name,
    title: option.jobTitle,
    membershipNo: option.membershipNo,
    role: defaultReportPreparerRole(option.isCompanyAdmin, nonManagerCount),
  };
}

export function reportTeamEquals(
  left: MvReportTeamMember[] | undefined,
  right: MvReportTeamMember[],
): boolean {
  return JSON.stringify(left ?? []) === JSON.stringify(right);
}
