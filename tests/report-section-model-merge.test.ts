import test from "node:test";
import assert from "node:assert/strict";
import {
  companyAddedReportSectionItems,
  createDetailedReportModelSections,
  createNewReportSectionModelSections,
  createReportSectionModelItem,
  reportSectionModelAnchor,
  reportSectionModelItemAnchor,
} from "../src/components/workspace/workspace-sections/machine-valuation/mv-report-section-models";
import { renderReportModelFlowSection } from "../src/components/workspace/workspace-sections/machine-valuation/mv-valuation-report-document-body";
import { getBlockAnchorFromNode } from "../src/components/workspace/workspace-sections/machine-valuation/mv-report-page-metrics";

test("company items added from the sidebar survive rebuilding a system section", () => {
  const systemSection = createDetailedReportModelSections()[0];
  assert.ok(systemSection);
  const addedItem = createReportSectionModelItem();
  addedItem.title = "بند شركة مضاف";

  const retained = companyAddedReportSectionItems(
    systemSection.items,
    [...systemSection.items, addedItem],
  );

  assert.deepEqual(retained, [addedItem]);
});

test("new-model sidebar anchors exactly match introduction and executive-summary report anchors", () => {
  const sections = createNewReportSectionModelSections();
  const introduction = sections.find((section) => section.systemAnchor === "mv-toc-1");
  const executiveSummary = sections.find((section) => section.systemAnchor === "mv-toc-24");
  assert.ok(introduction);
  assert.ok(executiveSummary);

  assert.equal(reportSectionModelAnchor("new-model", introduction), "mv-toc-1");
  assert.equal(reportSectionModelAnchor("new-model", executiveSummary), "mv-toc-24");
  assert.equal(
    reportSectionModelItemAnchor("new-model", introduction, introduction.items[0]!.id),
    `mv-toc-1--item-${introduction.items[0]!.id}`,
  );
  assert.equal(
    reportSectionModelItemAnchor("new-model", executiveSummary, executiveSummary.items[0]!.id),
    `mv-toc-24--item-${executiveSummary.items[0]!.id}`,
  );
});

test("model sections reach the paginator as native anchored sections", () => {
  for (const anchor of ["mv-toc-1", "mv-toc-24"]) {
    const node = renderReportModelFlowSection({
      id: `section:${anchor}`,
      anchor,
      title: anchor,
      items: [{ id: `item:${anchor}`, anchor: `${anchor}--item`, title: anchor, body: "body" }],
    });

    assert.equal(getBlockAnchorFromNode(node), anchor);
    assert.equal(node.props.id, anchor);
    assert.equal(node.props["data-mv-report-insert-anchor"], anchor);
  }
});
