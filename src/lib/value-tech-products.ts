/** Must match backend `valueTechProductIdSchema` / company entitlements.
 * العملاء والإعدادات ليستا «منتجات» — متاحان لكل شركة تلقائياً ولا تُحدَّد من السوبر أدمن.
 */
export const VALUE_TECH_PRODUCT_IDS = [
  "real-estate-valuation",
  "machine-valuation",
  "evaluation-source",
  "value-tech-app",
  "asset-inventory",
  "asset-inspection",
] as const;

export type ValueTechProductId = (typeof VALUE_TECH_PRODUCT_IDS)[number];

export const VALUE_TECH_PRODUCT_LABELS_AR: Record<ValueTechProductId, string> = {
  "real-estate-valuation": "تقييم العقارات",
  "machine-valuation": "تقييم الآلات",
  "evaluation-source": "مصادر المعلومات",
  "value-tech-app": "رفع التقارير",
  "asset-inventory": "حصر الأصول",
  "asset-inspection": "معاينة الأصول",
};

/** Maps workspace section key (from /w/...) to product id, or null = no entitlement check (hub, clients, settings, …). */
export function workspaceSectionToProductId(sectionKey: string): ValueTechProductId | null {
  if (sectionKey === "vt") return null;
  if (sectionKey.startsWith("evaluation-source")) return "evaluation-source";
  if (sectionKey.startsWith("machine-valuation")) return "machine-valuation";
  const first = sectionKey.split("/")[0] ?? sectionKey;
  if (first === "real-estate-valuation") return "real-estate-valuation";
  if (first === "value-tech-app") return "value-tech-app";
  if (first === "asset-inventory") return "asset-inventory";
  if (first === "asset-inspection") return "asset-inspection";
  if (first === "clients" || first === "settings") return null;
  return null;
}

export function userHasProductAccess(
  valueTechProductIds: string[] | null | undefined,
  productId: ValueTechProductId | null
): boolean {
  if (productId === null) return true;
  if (valueTechProductIds == null) return true;
  return valueTechProductIds.includes(productId);
}
