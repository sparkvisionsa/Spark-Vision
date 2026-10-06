import test from "node:test";
import assert from "node:assert/strict";
import { projectIconInitial, projectIconKind, projectIconSubject } from "../src/components/workspace/workspace-sections/machine-valuation/mv-project-name-icon-kind";
import { projectLibraryIcon, projectMaterialIcon } from "../src/components/workspace/workspace-sections/machine-valuation/mv-project-material-icon";

test("project icons recognize Arabic names with common prefixes and spelling variants", () => {
  assert.equal(projectIconKind("مشروع مستشفى النور"), "health");
  assert.equal(projectIconKind("شركة مصنع الأثاث الحديث"), "factory");
  assert.equal(projectIconKind("برج الاتصالات بالرياض"), "telecom");
  assert.equal(projectIconKind("محطة تحلية المياه"), "water");
  assert.equal(projectIconKind("مزرعة النخيل"), "farm");
  assert.equal(projectIconKind("مجمع تجاري"), "retail");
  assert.equal(projectIconKind("مُستودع التخزين"), "warehouse");
});

test("specific physical objects win over generic project words and inventory codes", () => {
  assert.equal(projectIconSubject("89-فرن حراري - NH474538 - INH015158 - 1"), "فرن حراري");
  assert.equal(projectMaterialIcon("89-فرن حراري - NH474538 - INH015158 - 1")?.icon, "heater");
  assert.equal(projectMaterialIcon("مصنع به رافعة شوكية")?.icon, "forklift");
  assert.equal(projectMaterialIcon("مضخات مياه محطة صناعية")?.icon, "droplets");
  assert.equal(projectMaterialIcon("سيارة إسعاف حديثة")?.icon, "ambulance");
  assert.equal(projectMaterialIcon("سيارة الإسعاف الحديثة")?.icon, "ambulance");
  assert.equal(projectMaterialIcon("صيانة للفرن الحراري")?.icon, "heater");
  assert.equal(projectIconInitial("89-فرن حراري - NH474538"), "ف");
});

test("an exact English object can use an icon from the wider library", () => {
  const available = new Set(["piano", "factory", "car-front"]);
  assert.equal(projectLibraryIcon("Piano Factory - XX987654", available), "piano");
  assert.equal(projectLibraryIcon("Project Cedar", available), null);
});

test("project icons recognize English names and keep unknown names tied to their title", () => {
  assert.equal(projectIconKind("Al Noor Medical Center"), "health");
  assert.equal(projectIconKind("Solar Energy Plant"), "energy");
  assert.equal(projectIconKind("East Rail Station"), "rail");
  assert.equal(projectIconKind("Project Cedar"), "generic");
  assert.equal(projectIconKind("Small Business Plaza"), "generic");
  assert.equal(projectIconKind("Carpet Gallery"), "generic");
  assert.equal(projectIconInitial("مشروع شركة الواحة"), "و");
  assert.equal(projectIconInitial("Project Cedar"), "C");
});
