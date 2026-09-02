const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const scales = [
  { singular: "", dual: "", plural: "" },
  { singular: "ألف", dual: "ألفان", plural: "آلاف" },
  { singular: "مليون", dual: "مليونان", plural: "ملايين" },
  { singular: "مليار", dual: "ملياران", plural: "مليارات" },
  { singular: "تريليون", dual: "تريليونان", plural: "تريليونات" },
] as const;

function threeDigits(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"][h]!);
  if (r) {
    const tail =
      r < 10 ? ones[r] : r < 20 ? teens[r - 10] : r % 10 ? `${ones[r % 10]} و${tens[Math.floor(r / 10)]}` : tens[Math.floor(r / 10)];
    parts.push(tail);
  }
  return parts.join(" و");
}

function groupWords(value: number, index: number): string {
  if (!value) return "";
  const scale = scales[index]!;
  if (!index) return threeDigits(value);
  if (value === 1) return scale.singular;
  if (value === 2) return scale.dual;
  const number = threeDigits(value);
  return `${number} ${value >= 3 && value <= 10 ? scale.plural : scale.singular}`;
}

export function saudiRiyalWords(input: string | number): string {
  const normalized = String(input)
    .replace(/[٠-٩]/g, (v) => String(v.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (v) => String(v.charCodeAt(0) - 1776))
    .replace(/[,\s٬]/g, "")
    .replace("٫", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return "";
  const [wholeRaw, fractionRaw = ""] = normalized.split(".");
  const whole = Number(wholeRaw);
  if (!Number.isSafeInteger(whole) || whole > 999_999_999_999_999) return "";
  if (whole === 0) return "صفر ريال سعودي لا غير";
  const groups: string[] = [];
  let remaining = whole;
  let index = 0;
  while (remaining > 0) {
    const value = remaining % 1000;
    const text = groupWords(value, index);
    if (text) groups.unshift(text);
    remaining = Math.floor(remaining / 1000);
    index += 1;
  }
  const fraction = fractionRaw ? Number(fractionRaw.padEnd(2, "0")) : 0;
  return `${groups.join(" و")} ريال سعودي${fraction ? ` و${threeDigits(fraction)} هللة` : ""} لا غير`;
}
