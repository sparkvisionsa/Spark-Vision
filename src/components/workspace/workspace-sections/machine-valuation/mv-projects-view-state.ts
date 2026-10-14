export const MV_PROJECTS_PAGE_SIZES = [5, 10, 50, 100] as const;
export type MvProjectsPageSize = (typeof MV_PROJECTS_PAGE_SIZES)[number];
export type MvProjectsStoredStatusFilter = "all" | "new" | "review" | "approved";

export type MvProjectsViewState = {
  currentPage: number;
  pageSize: MvProjectsPageSize;
  projectQuery: string;
  statusFilter: MvProjectsStoredStatusFilter;
  sortRecentlyWorked: boolean;
};

export const DEFAULT_MV_PROJECTS_VIEW_STATE: MvProjectsViewState = {
  currentPage: 1,
  pageSize: 10,
  projectQuery: "",
  statusFilter: "all",
  sortRecentlyWorked: false,
};

const MV_PROJECTS_VIEW_STATE_KEY = "mv:projects:view:v1";
const STATUS_FILTERS = new Set<MvProjectsStoredStatusFilter>(["all", "new", "review", "approved"]);

export function normalizeMvProjectsViewState(value: unknown): MvProjectsViewState {
  if (!value || typeof value !== "object") return { ...DEFAULT_MV_PROJECTS_VIEW_STATE };
  const raw = value as Partial<Record<keyof MvProjectsViewState, unknown>>;
  const currentPage = typeof raw.currentPage === "number" && Number.isInteger(raw.currentPage) && raw.currentPage > 0
    ? raw.currentPage
    : DEFAULT_MV_PROJECTS_VIEW_STATE.currentPage;
  const pageSize = typeof raw.pageSize === "number" &&
    MV_PROJECTS_PAGE_SIZES.includes(raw.pageSize as MvProjectsPageSize)
    ? raw.pageSize as MvProjectsPageSize
    : DEFAULT_MV_PROJECTS_VIEW_STATE.pageSize;
  const statusFilter = typeof raw.statusFilter === "string" &&
    STATUS_FILTERS.has(raw.statusFilter as MvProjectsStoredStatusFilter)
    ? raw.statusFilter as MvProjectsStoredStatusFilter
    : DEFAULT_MV_PROJECTS_VIEW_STATE.statusFilter;

  return {
    currentPage,
    pageSize,
    projectQuery: typeof raw.projectQuery === "string" ? raw.projectQuery.slice(0, 200) : "",
    statusFilter,
    sortRecentlyWorked: raw.sortRecentlyWorked === true,
  };
}

export function readMvProjectsViewState(): MvProjectsViewState {
  if (typeof sessionStorage === "undefined") return { ...DEFAULT_MV_PROJECTS_VIEW_STATE };
  try {
    const raw = sessionStorage.getItem(MV_PROJECTS_VIEW_STATE_KEY);
    return raw ? normalizeMvProjectsViewState(JSON.parse(raw)) : { ...DEFAULT_MV_PROJECTS_VIEW_STATE };
  } catch {
    return { ...DEFAULT_MV_PROJECTS_VIEW_STATE };
  }
}

export function writeMvProjectsViewState(state: MvProjectsViewState) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(MV_PROJECTS_VIEW_STATE_KEY, JSON.stringify(normalizeMvProjectsViewState(state)));
  } catch {
    /* quota/private mode */
  }
}

export function clearMvProjectsViewState() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(MV_PROJECTS_VIEW_STATE_KEY);
  } catch {
    /* ignore */
  }
}
