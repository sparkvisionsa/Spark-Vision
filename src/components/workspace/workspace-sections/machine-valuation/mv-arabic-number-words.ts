const ONES = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
] as const;

const TEENS = [
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
] as const;

const TENS = [
  "",
  "",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
] as const;

const HUNDREDS = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
] as const;

type Scale = {
  singular: string;
  dual: string;
  plural: string;
  accusative: string;
};

const SCALES: Scale[] = [
  { singular: "", dual: "", plural: "", accusative: "" },
  { singular: "ألف", dual: "ألفان", plural: "آلاف", accusative: "ألف" },
  { singular: "مليون", dual: "مليونان", plural: "ملايين", accusative: "مليون" },
  { singular: "مليار", dual: "ملياران", plural: "مليارات", accusative: "مليار" },
  { singular: "تريليون", dual: "تريليونان", plural: "تريليونات", accusative: "تريليون" },
];

function belowHundredToWords(value: number): string {
  if (value < 10) return ONES[value] ?? "";
  if (value < 20) return TEENS[value - 10] ?? "";
  const ones = value % 10;
  const tens = Math.floor(value / 10);
  if (ones === 0) return TENS[tens] ?? "";
  return `${ONES[ones]} و${TENS[tens]}`;
}

function belowThousandToWords(value: number): string {
  if (value < 100) return belowHundredToWords(value);
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const head = HUNDREDS[hundreds] ?? "";
  if (rest === 0) return head;
  return `${head} و${belowHundredToWords(rest)}`;
}

function scaleGroupToWords(groupValue: number, scaleIndex: number): string {
  if (scaleIndex === 0) return belowThousandToWords(groupValue);
  const scale = SCALES[scaleIndex];
  if (!scale) return belowThousandToWords(groupValue);
  if (groupValue === 1) return scale.singular;
  if (groupValue === 2) return scale.dual;
  if (groupValue >= 3 && groupValue <= 10) {
    return `${belowThousandToWords(groupValue)} ${scale.plural}`;
  }
  return `${belowThousandToWords(groupValue)} ${scale.accusative}`;
}

export function numberToArabicRiyalWords(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";

  const integer = Math.floor(Math.abs(value));
  if (integer === 0) return "صفر ريال سعودي لا غير";

  const groups: number[] = [];
  let remaining = integer;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const parts: string[] = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const groupValue = groups[index] ?? 0;
    if (groupValue === 0) continue;
    parts.push(scaleGroupToWords(groupValue, index));
  }

  const sign = value < 0 ? "سالب " : "";
  return `${sign}${parts.join(" و")} ريال سعودي لا غير`;
}
