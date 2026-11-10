import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeSaudiRiyalAmount } from "../src/lib/saudi-riyal-words";

test("keeps only the numeric amount from pasted text", () => {
  assert.equal(sanitizeSaudiRiyalAmount("754236 رس"), "754236");
  assert.equal(sanitizeSaudiRiyalAmount("المبلغ ٧٥٤٢٣٦ ريال"), "754236");
});

test("normalizes grouping and decimal separators", () => {
  assert.equal(sanitizeSaudiRiyalAmount("SAR 1,234.50"), "1234.50");
  assert.equal(sanitizeSaudiRiyalAmount("١٬٢٣٤٫٥٠ ر.س"), "1234.50");
});

test("limits the amount to supported precision", () => {
  assert.equal(sanitizeSaudiRiyalAmount("12.345"), "12.34");
  assert.equal(sanitizeSaudiRiyalAmount("لا يوجد مبلغ"), "");
});
