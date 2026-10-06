export type ProjectIconKind =
  | "airport" | "ship" | "rail" | "health" | "education" | "factory"
  | "warehouse" | "fuel" | "energy" | "water" | "farm" | "hotel"
  | "restaurant" | "retail" | "finance" | "office" | "telecom"
  | "technology" | "construction" | "vehicle" | "transport" | "religious"
  | "residential" | "land" | "sports" | "machinery" | "mining" | "generic";

const RULES: ReadonlyArray<{ kind: ProjectIconKind; pattern: RegExp }> = [
  { kind: "airport", pattern: /مطار|طيران|طائره|airport|aviation|aircraft|airline/u },
  { kind: "ship", pattern: /ميناء|مرفا|سفين|بحري|maritime|seaport|harbou?r|vessel|shipyard/u },
  { kind: "rail", pattern: /قطار|سكك|مترو|\brail\b|\bmetro\b|\btrain\b|\btram\b/u },
  { kind: "health", pattern: /مستشف|عياد|مركز طبي|مجمع طبي|صيدل|مختبر طبي|صحي|اسعاف|hospital|clinic|medical|pharma|healthcare|health center/u },
  { kind: "education", pattern: /مدرس|جامع[هة]|كلي[هة]|معهد|تعليم|روضة|حضان|school|universit|college|academy|kindergarten|education/u },
  { kind: "factory", pattern: /مصنع|معمل|تصنيع|صناع|انتاج|factory|manufactur|industrial|production/u },
  { kind: "warehouse", pattern: /مستودع|مخزن|مخازن|تخزين|warehouse|storage|depot/u },
  { kind: "fuel", pattern: /نفط|بترول|وقود|غاز|تكرير|مصفاه|oilfield|petroleum|refiner|fuel|gas station/u },
  { kind: "energy", pattern: /كهرب|طاق[هة]|شمسي|رياح|توربين|power|electric|solar|wind farm|energy/u },
  { kind: "water", pattern: /مياه|ماء|تحليه|صرف صحي|سد|water|desalin|wastewater|\bdam\b/u },
  { kind: "farm", pattern: /مزرع|زراع|نخيل|بيوت محمي|اغنام|مواشي|دواجن|farm|agricultur|greenhouse|livestock|poultry/u },
  { kind: "hotel", pattern: /فندق|منتجع|ضياف|شاليه|hotel|resort|hospitality|chalet/u },
  { kind: "restaurant", pattern: /مطعم|مقهى|كوفي|كافيه|مطبخ|مخبز|restaurant|cafe|coffee|bakery|kitchen/u },
  { kind: "retail", pattern: /سوق|متجر|محل تجاري|مول|تسوق|تجاري|retail|shopping|market|\bmall\b|supermarket|\bstore\b/u },
  { kind: "finance", pattern: /بنك|مصرف|مالي|تمويل|تأمين|تامين|\bbank\b|finance|insurance|exchange/u },
  { kind: "office", pattern: /مكتب|مكاتب|مقر ادار|مبنى ادار|اداري|office|headquarter|business center/u },
  { kind: "telecom", pattern: /اتصالات|شبك[هة]|برج اتصال|telecom|network tower|cell tower|wireless/u },
  { kind: "technology", pattern: /تقني|برمج|بيانات|حاسوب|كمبيوتر|ذكاء اصطناعي|data center|software|technology|tech hub|server|computing/u },
  { kind: "construction", pattern: /انشاء|مقاول|تشييد|بناء|تطوير عقاري|construction|contractor|building site|real estate development/u },
  { kind: "vehicle", pattern: /سيار|مركب|حافل|حافلات|شاحن|\bcar\b|automotive|vehicle|bus fleet/u },
  { kind: "transport", pattern: /نقل|لوجست|شحن|توصيل|transport|logistic|freight|delivery/u },
  { kind: "religious", pattern: /مسجد|جامع|مصلى|وقف|mosque|masjid/u },
  { kind: "residential", pattern: /برج|سكن|شقق|فيلا|فلل|قصر|منزل|بيت|مجمع سكن|tower|residen|apartment|villa|housing|\bhome\b/u },
  { kind: "land", pattern: /ارض|اراضي|مخطط|قطعه|land plot|parcel|landscape/u },
  { kind: "sports", pattern: /ملعب|نادي رياضي|رياض[هة]|استاد|stadium|sport|gym|fitness/u },
  { kind: "machinery", pattern: /معدات|آلات|الات|رافعات|مولدات|ماكين|machiner|equipment|crane|generator/u },
  { kind: "mining", pattern: /تعدين|منجم|محجر|ذهب|معادن|mining|\bmine\b|quarry|mineral/u },
];

export function normalizeProjectIconName(name: string): string {
  return name
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/gu, "")
    .replace(/[أإآٱ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ة/gu, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Ignore serial numbers and inventory codes while looking for the named object. */
export function projectIconSubject(name: string): string {
  return normalizeProjectIconName(name)
    .split(" ")
    .filter((word) => word && !/^\d+$/u.test(word) && !/^(?=[a-z0-9]*\d)[a-z0-9]{5,}$/u.test(word))
    .join(" ");
}

export function projectIconKind(name: string): ProjectIconKind {
  const normalized = projectIconSubject(name);
  if (!normalized) return "generic";
  return RULES.find(({ pattern }) => pattern.test(normalized))?.kind ?? "generic";
}

export function projectIconInitial(name: string): string {
  const normalized = projectIconSubject(name)
    .replace(/^(?:(?:مشروع|تقييم|شركه|مؤسسه|project|company)\s+)+/u, "")
    .replace(/^ال(?=[\p{L}]{2,})/u, "")
    .replace(/^the\s+/u, "");
  return Array.from(normalized)[0]?.toLocaleUpperCase() ?? "•";
}
