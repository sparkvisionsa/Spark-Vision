import assert from "node:assert/strict";
import test from "node:test";
import {
  MV_PROJECTS_PAGE_SIZES,
  normalizeMvProjectsViewState,
  readMvProjectsViewState,
  writeMvProjectsViewState,
} from "../src/components/workspace/workspace-sections/machine-valuation/mv-projects-view-state";

test("projects view state preserves the current page and supported page size", () => {
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });

  try {
    writeMvProjectsViewState({
      currentPage: 4,
      pageSize: 50,
      projectQuery: "رافعات",
      statusFilter: "review",
      sortRecentlyWorked: true,
    });
    assert.deepEqual(readMvProjectsViewState(), {
      currentPage: 4,
      pageSize: 50,
      projectQuery: "رافعات",
      statusFilter: "review",
      sortRecentlyWorked: true,
    });
  } finally {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    else delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  }
});

test("projects pagination accepts only 5, 10, 50, and 100 rows", () => {
  assert.deepEqual(MV_PROJECTS_PAGE_SIZES, [5, 10, 50, 100]);
  assert.deepEqual(normalizeMvProjectsViewState({ currentPage: -3, pageSize: 8 }), {
    currentPage: 1,
    pageSize: 10,
    projectQuery: "",
    statusFilter: "all",
    sortRecentlyWorked: false,
  });
});
