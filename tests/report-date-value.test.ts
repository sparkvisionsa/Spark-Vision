import assert from "node:assert/strict";
import test from "node:test";
import { toReportDateInputValue } from "../src/components/workspace/workspace-sections/machine-valuation/mv-report-date-value";

test("date inputs accept printed gregorian and hijri values", () => {
  assert.equal(toReportDateInputValue("2024-05-12"), "2024-05-12");
  assert.equal(toReportDateInputValue("2024/5/12"), "2024-05-12");
  assert.equal(toReportDateInputValue("12/05/2024"), "2024-05-12");
  assert.equal(toReportDateInputValue("12-05-2024"), "2024-05-12");
  assert.equal(toReportDateInputValue("١٢/٠٥/٢٠٢٤"), "2024-05-12");
  assert.equal(toReportDateInputValue("12 مايو 2024"), "2024-05-12");
  assert.equal(toReportDateInputValue("12 أبريل 2024"), "2024-04-12");
  assert.equal(toReportDateInputValue("1446/01/01"), "2024-07-07");
  assert.equal(toReportDateInputValue("01/01/1446"), "2024-07-07");
  assert.equal(toReportDateInputValue("1446-01-01 هـ"), "2024-07-07");
  assert.equal(toReportDateInputValue("1 رمضان 1445"), "2024-03-11");
  assert.equal(toReportDateInputValue("ليس تاريخاً"), "");
  assert.equal(toReportDateInputValue("2024-02-31"), "");
});
