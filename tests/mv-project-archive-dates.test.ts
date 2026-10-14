import assert from "node:assert/strict";
import test from "node:test";
import { resolveProjectArchiveDates } from "../src/components/workspace/workspace-sections/machine-valuation/mv-project-archive-dates";

test("archive dates fall back to the deletion date for responses from older backends", () => {
  const dates = resolveProjectArchiveDates({ deletedAt: "2026-01-15T10:30:00.000Z" });

  assert.equal(dates.deletedAt?.toISOString(), "2026-01-15T10:30:00.000Z");
  assert.equal(dates.companyRestoreUntil?.toISOString(), "2026-02-14T10:30:00.000Z");
  assert.equal(dates.purgeAt?.toISOString(), "2027-01-15T10:30:00.000Z");
});

test("invalid archive dates are returned as null instead of throwing during rendering", () => {
  const dates = resolveProjectArchiveDates({
    deletedAt: "not-a-date",
    companyRestoreUntil: undefined,
    purgeAt: "",
  });

  assert.equal(dates.deletedAt, null);
  assert.equal(dates.companyRestoreUntil, null);
  assert.equal(dates.purgeAt, null);
});
