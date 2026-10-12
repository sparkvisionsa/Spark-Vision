import test from "node:test";
import assert from "node:assert/strict";
import { SUPPORT_AUTO_SUBJECT_WORDS, ticketContentFromRequest } from "../src/components/support/support-validation";
import { supportParticipantName } from "../src/components/support/support-types";

test("one ticket field creates a three-keyword title and preserves the complete first message", () => {
  const request = "  Please save the valuation project because the asset images fail to upload and the project save fails.  ";
  const content = ticketContentFromRequest(request);

  assert.equal(content.text, request.trim());
  assert.equal(content.subject, "save valuation project");
  assert.equal(content.subject.split(" ").length, SUPPORT_AUTO_SUBJECT_WORDS);
});

test("the generated title excludes generic wording from the description", () => {
  const content = ticketContentFromRequest("أريد المساعدة في رفع صور المشروع لأن رفع الصور يفشل دائماً");
  assert.equal(content.subject, "رفع صور المشروع");
});

test("customers see the unified technical support identity", () => {
  assert.equal(supportParticipantName(true, "admin-0500000004", false), "الدعم الفني");
  assert.equal(supportParticipantName(true, "موظف الدعم الداخلي", true), "موظف الدعم الداخلي");
  assert.equal(supportParticipantName(false, "صاحب التذكرة", false), "صاحب التذكرة");
});
