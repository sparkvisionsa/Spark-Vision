import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { developerRequestsHref, supportHref } from "../src/components/support/support-types";

test("product support links remain inside their product and public links stay generic", () => {
  assert.equal(supportHref("general"), "/support?product=general");
  assert.equal(supportHref("real-estate-valuation"), "/real-estate-valuation/support?product=real-estate-valuation");
  assert.equal(supportHref("machine-valuation"), "/machine-valuation/support?product=machine-valuation");
  assert.equal(developerRequestsHref("helper-tools"), "/helper-tools/developer-requests?product=helper-tools");
  assert.equal(developerRequestsHref(), "/developer-requests");
});

test("middleware rewrites product support routes without changing the browser URL", () => {
  for (const [path, expected] of [
    ["/real-estate-valuation/support", "/w/real-estate-valuation/support"],
    ["/helper-tools/developer-requests", "/w/helper-tools/developer-requests"],
    ["/machine-valuation/developer-requests", "/w/machine-valuation/developer-requests"],
  ]) {
    const response = middleware(new NextRequest(`http://localhost:3000${path}`));
    assert.equal(response.headers.get("x-middleware-rewrite"), `http://localhost:3000${expected}`);
  }
});
