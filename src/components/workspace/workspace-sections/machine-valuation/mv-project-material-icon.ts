import type { IconName } from "lucide-react/dynamic";
import { normalizeProjectIconName, projectIconSubject } from "./mv-project-name-icon-kind";

export type MaterialIconTone = "cyan" | "blue" | "emerald" | "amber" | "rose" | "violet" | "slate";
export type ProjectMaterialIcon = { icon: IconName; tone: MaterialIconTone };

type MaterialRule = ProjectMaterialIcon & { terms: readonly string[] };

// Named physical objects take precedence over broad project types. The icon is loaded only when needed.
const MATERIAL_RULES: readonly MaterialRule[] = [
  { icon: "fire-extinguisher", tone: "rose", terms: ["طفاية حريق", "مطفأة حريق", "fire extinguisher"] },
  { icon: "forklift", tone: "amber", terms: ["رافعة شوكية", "فوركلفت", "forklift"] },
  { icon: "circuit-board", tone: "amber", terms: ["لوحة كهربائية", "لوحة تحكم", "electrical panel", "control panel"] },
  { icon: "sun", tone: "amber", terms: ["لوح شمسي", "ألواح شمسية", "solar panel", "photovoltaic"] },
  { icon: "plug-zap", tone: "amber", terms: ["محول كهربائي", "محولات كهربائية", "electric transformer", "transformer"] },
  { icon: "accessibility", tone: "blue", terms: ["كرسي متحرك", "wheelchair"] },
  { icon: "scan-line", tone: "blue", terms: ["أشعة سينية", "جهاز أشعة", "x ray", "x-ray"] },
  { icon: "ambulance", tone: "rose", terms: ["سيارة اسعاف", "عربة اسعاف", "ambulance"] },
  { icon: "camera", tone: "slate", terms: ["كاميرا مراقبة", "cctv", "security camera"] },
  { icon: "microwave", tone: "amber", terms: ["ميكرويف", "microwave"] },
  { icon: "heater", tone: "amber", terms: ["فرن", "أفران", "oven", "ovens", "furnace", "kiln", "industrial oven"] },
  { icon: "heater", tone: "amber", terms: ["غلاية", "مرجل", "سخان", "boiler", "heater"] },
  { icon: "refrigerator", tone: "cyan", terms: ["ثلاجة", "ثلاجات", "براد", "مجمد", "فريزر", "refrigerator", "fridge", "freezer"] },
  { icon: "air-vent", tone: "cyan", terms: ["مكيف", "تكييف", "air conditioner", "air conditioning", "hvac"] },
  { icon: "droplets", tone: "cyan", terms: ["مضخة", "مضخات", "مضخ", "pump", "pumps"] },
  { icon: "wind", tone: "cyan", terms: ["ضاغط", "كمبروسر", "compressor"] },
  { icon: "construction", tone: "amber", terms: ["رافعة", "رافعات", "crane", "cranes"] },
  { icon: "shovel", tone: "amber", terms: ["حفار", "حفارة", "excavator", "bulldozer"] },
  { icon: "tractor", tone: "emerald", terms: ["جرار", "تراكتور", "tractor"] },
  { icon: "plug-zap", tone: "amber", terms: ["مولد", "مولدات", "generator", "generators"] },
  { icon: "fan", tone: "cyan", terms: ["توربين", "turbine", "turbines"] },
  { icon: "cog", tone: "slate", terms: ["محرك", "موتور", "motor", "engine"] },
  { icon: "battery", tone: "emerald", terms: ["بطارية", "بطاريات", "battery", "batteries"] },
  { icon: "cylinder", tone: "blue", terms: ["خزان", "خزانات", "tank", "reservoir"] },
  { icon: "cylinder", tone: "slate", terms: ["أنبوب", "انابيب", "ماسورة", "pipe", "pipeline"] },
  { icon: "settings-2", tone: "slate", terms: ["صمام", "valve"] },
  { icon: "cable", tone: "slate", terms: ["كابل", "كيبل", "سلك", "cable", "wire"] },
  { icon: "gauge", tone: "blue", terms: ["عداد", "مقياس", "gauge", "meter"] },
  { icon: "scale", tone: "slate", terms: ["ميزان", "موازين", "scale", "weighing"] },
  { icon: "bot", tone: "violet", terms: ["روبوت", "robot"] },
  { icon: "printer", tone: "violet", terms: ["طابعة", "طابعات", "printer"] },
  { icon: "scan-line", tone: "violet", terms: ["ماسح ضوئي", "اسكنر", "scanner"] },
  { icon: "laptop", tone: "violet", terms: ["لابتوب", "حاسب محمول", "laptop"] },
  { icon: "monitor", tone: "violet", terms: ["حاسوب", "كمبيوتر", "computer", "desktop"] },
  { icon: "server", tone: "violet", terms: ["خادم", "سيرفر", "server"] },
  { icon: "router", tone: "violet", terms: ["راوتر", "موجه", "router"] },
  { icon: "camera", tone: "slate", terms: ["كاميرا", "آلة تصوير", "camera"] },
  { icon: "smartphone", tone: "violet", terms: ["هاتف", "جوال", "موبايل", "phone", "smartphone", "mobile"] },
  { icon: "tv", tone: "violet", terms: ["تلفاز", "تلفزيون", "television", "tv"] },
  { icon: "projector", tone: "violet", terms: ["بروجكتر", "عارض ضوئي", "projector"] },
  { icon: "speaker", tone: "violet", terms: ["مكبر صوت", "سماعة", "speaker"] },
  { icon: "radio-tower", tone: "violet", terms: ["هوائي", "antenna"] },
  { icon: "armchair", tone: "rose", terms: ["كرسي", "مقعد", "chair"] },
  { icon: "sofa", tone: "rose", terms: ["كنبة", "اريكة", "sofa", "couch"] },
  { icon: "bed-double", tone: "blue", terms: ["سرير", "اسرة", "bed"] },
  { icon: "table", tone: "amber", terms: ["طاولة", "منضدة", "table"] },
  { icon: "door-open", tone: "amber", terms: ["باب", "بوابة", "door", "gate"] },
  { icon: "lamp", tone: "amber", terms: ["مصباح", "إنارة", "lamp", "lighting"] },
  { icon: "move-vertical", tone: "blue", terms: ["مصعد", "اسانسير", "elevator", "lift"] },
  { icon: "container", tone: "slate", terms: ["حاوية", "حاويات", "container"] },
  { icon: "truck", tone: "cyan", terms: ["شاحنة", "شاحنات", "truck", "lorry"] },
  { icon: "bus-front", tone: "cyan", terms: ["حافلة", "باص", "bus", "coach"] },
  { icon: "bike", tone: "cyan", terms: ["دراجة", "دراجة نارية", "bicycle", "motorcycle", "bike"] },
  { icon: "car-front", tone: "slate", terms: ["سيارة", "سيارات", "car", "vehicle"] },
  { icon: "sailboat", tone: "cyan", terms: ["قارب", "يخت", "boat", "yacht"] },
  { icon: "ship", tone: "blue", terms: ["سفينة", "باخرة", "ship", "vessel"] },
  { icon: "plane", tone: "cyan", terms: ["طائرة", "airplane", "aircraft", "plane"] },
  { icon: "train-front", tone: "blue", terms: ["قطار", "train"] },
  { icon: "tree-palm", tone: "emerald", terms: ["نخلة", "نخيل", "palm"] },
  { icon: "tree-pine", tone: "emerald", terms: ["شجرة", "اشجار", "tree"] },
  { icon: "beef", tone: "emerald", terms: ["بقرة", "ابقار", "ماشية", "cattle", "cow"] },
  { icon: "bird", tone: "emerald", terms: ["دجاج", "دواجن", "poultry", "chicken"] },
  { icon: "microscope", tone: "rose", terms: ["مجهر", "microscope"] },
  { icon: "syringe", tone: "rose", terms: ["حقنة", "ابر طبية", "syringe"] },
  { icon: "vault", tone: "slate", terms: ["خزنة", "خزينة", "safe", "vault"] },
  { icon: "siren", tone: "rose", terms: ["إنذار", "صافرة", "alarm", "siren"] },
  { icon: "route", tone: "slate", terms: ["جسر", "طريق", "bridge", "road"] },
  { icon: "logs", tone: "amber", terms: ["خشب", "اخشاب", "wood", "timber"] },
  { icon: "anvil", tone: "slate", terms: ["حديد", "فولاذ", "steel", "iron"] },
  { icon: "brick-wall", tone: "amber", terms: ["خرسانة", "طوب", "brick", "concrete"] },
  { icon: "clock", tone: "blue", terms: ["ساعة", "clock", "watch"] },
  { icon: "coffee", tone: "amber", terms: ["آلة قهوة", "ماكينة قهوة", "coffee machine"] },
  { icon: "workflow", tone: "slate", terms: ["سير ناقل", "سيور ناقلة", "conveyor"] },
];

const PREPARED_RULES = MATERIAL_RULES.map((rule) => ({
  ...rule,
  terms: rule.terms.map(normalizeProjectIconName),
}));

function bareWord(word: string): string {
  if (word.startsWith("لل") && word.length > 4) return word.slice(2);
  if (/^(?:وال|بال|كال|فال)/u.test(word) && word.length > 5) return word.slice(3);
  if (word.startsWith("ال") && word.length > 4) return word.slice(2);
  return word;
}

function subjectWords(subject: string): string[] {
  const words = subject.split(" ").filter(Boolean);
  return words.flatMap((word) => {
    const variants = [word, bareWord(word)];
    if (/^[a-z]+s$/u.test(word) && word.length > 5) variants.push(word.slice(0, -1));
    return variants;
  });
}

function hasTerm(subject: string, bareSubject: string, words: readonly string[], term: string): boolean {
  if (term.includes(" ")) return (` ${subject} `).includes(` ${term} `) || (` ${bareSubject} `).includes(` ${term} `);
  const arabic = /[\u0600-\u06ff]/u.test(term);
  return words.some((word) => word === term || (term.length >= (arabic ? 4 : 5) && word.startsWith(term)));
}

export function projectMaterialIcon(name: string): ProjectMaterialIcon | null {
  const subject = projectIconSubject(name);
  if (!subject) return null;
  const words = subjectWords(subject);
  const bareSubject = subject.split(" ").map(bareWord).join(" ");
  const match = PREPARED_RULES.find((rule) => rule.terms.some((term) => hasTerm(subject, bareSubject, words, term)));
  return match ? { icon: match.icon, tone: match.tone } : null;
}

/** Exact title words can use any icon shipped by the installed Lucide version. */
export function projectLibraryIcon(name: string, availableIconNames: ReadonlySet<string>): IconName | null {
  const words = projectIconSubject(name).split(" ").filter((word) => /^[a-z]+$/u.test(word));
  if (!words.length) return null;
  const ignored = new Set(["project", "company", "report", "valuation", "asset", "assets", "new", "the", "and", "for", "with"]);
  for (let length = Math.min(3, words.length); length >= 1; length -= 1) {
    for (let index = 0; index <= words.length - length; index += 1) {
      const segment = words.slice(index, index + length);
      if (segment.some((word) => ignored.has(word))) continue;
      const icon = segment.join("-");
      if (icon.length >= 4 && availableIconNames.has(icon)) return icon as IconName;
    }
  }
  return null;
}
