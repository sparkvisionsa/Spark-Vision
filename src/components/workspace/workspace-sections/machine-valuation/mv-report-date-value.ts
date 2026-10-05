const HIJRI_MONTHS: Array<[string, number]> = [
  ["جمادي الاخره", 6],
  ["جمادي الثانيه", 6],
  ["جمادي الاولي", 5],
  ["جمادي الاوله", 5],
  ["ربيع الثاني", 4],
  ["ربيع الاخر", 4],
  ["ربيع الاول", 3],
  ["ذو القعده", 11],
  ["ذي القعده", 11],
  ["ذوالقعده", 11],
  ["ذو الحجه", 12],
  ["ذي الحجه", 12],
  ["ذوالحجه", 12],
  ["محرم", 1],
  ["صفر", 2],
  ["رجب", 7],
  ["شعبان", 8],
  ["رمضان", 9],
  ["شوال", 10],
];

const GREGORIAN_MONTHS: Array<[string, number]> = [
  ["january", 1],
  ["february", 2],
  ["march", 3],
  ["april", 4],
  ["june", 6],
  ["july", 7],
  ["august", 8],
  ["september", 9],
  ["october", 10],
  ["november", 11],
  ["december", 12],
  ["jan", 1],
  ["feb", 2],
  ["mar", 3],
  ["apr", 4],
  ["may", 5],
  ["jun", 6],
  ["jul", 7],
  ["aug", 8],
  ["sep", 9],
  ["sept", 9],
  ["oct", 10],
  ["nov", 11],
  ["dec", 12],
  ["يناير", 1],
  ["فبراير", 2],
  ["مارس", 3],
  ["ابريل", 4],
  ["مايو", 5],
  ["يونيو", 6],
  ["يوليو", 7],
  ["اغسطس", 8],
  ["سبتمبر", 9],
  ["اكتوبر", 10],
  ["نوفمبر", 11],
  ["ديسمبر", 12],
  ["كانون الثاني", 1],
  ["شباط", 2],
  ["اذار", 3],
  ["نيسان", 4],
  ["ايار", 5],
  ["حزيران", 6],
  ["تموز", 7],
  ["اب", 8],
  ["ايلول", 9],
  ["تشرين الاول", 10],
  ["تشرين الثاني", 11],
  ["كانون الاول", 12],
];

function toLatinDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}

function normalizeDateText(value: string) {
  return toLatinDigits(value)
    .replace(/[\u064B-\u065F\u0670\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[،,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatGregorian(year: number, month: number, day: number) {
  if (year < 1700 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function isHijriYear(year: number) {
  return year >= 1200 && year <= 1600;
}

let hijriFormatter: Intl.DateTimeFormat | null | undefined;

function ummAlQuraFormatter() {
  if (hijriFormatter !== undefined) return hijriFormatter;
  try {
    const formatter = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura-nu-latn", {
      timeZone: "UTC",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    hijriFormatter = formatter.resolvedOptions().calendar === "islamic-umalqura" ? formatter : null;
  } catch {
    hijriFormatter = null;
  }
  return hijriFormatter;
}

function hijriToIso(year: number, month: number, day: number) {
  if (!isHijriYear(year) || month < 1 || month > 12 || day < 1 || day > 30) return "";
  const formatter = ummAlQuraFormatter();
  if (!formatter) return "";
  const approxYear = year + 622 - Math.floor(year / 33);
  const start = Date.UTC(approxYear - 1, 0, 1);
  const end = Date.UTC(approxYear + 2, 0, 1);
  for (let time = start; time < end; time += 86_400_000) {
    const parts = formatter.formatToParts(new Date(time));
    const foundYear = Number(parts.find((part) => part.type === "year")?.value);
    const foundMonth = Number(parts.find((part) => part.type === "month")?.value);
    const foundDay = Number(parts.find((part) => part.type === "day")?.value);
    if (foundYear === year && foundMonth === month && foundDay === day) {
      return new Date(time).toISOString().slice(0, 10);
    }
  }
  return "";
}

function fromNumericDate(first: number, second: number, third: number, forceHijri: boolean) {
  let year = 0;
  let month = 0;
  let day = 0;
  if (first >= 1000) {
    year = first;
    month = second;
    day = third;
  } else if (third >= 1000 || third < 100) {
    day = first;
    month = second;
    year = third < 100 ? (third >= 70 ? 1900 + third : 2000 + third) : third;
  } else {
    return "";
  }
  if (forceHijri || isHijriYear(year)) return hijriToIso(year, month, day);
  return formatGregorian(year, month, day);
}

function fromNamedDate(text: string) {
  const months = [
    ...HIJRI_MONTHS.map(([name, month]) => ({ name, month, hijri: true })),
    ...GREGORIAN_MONTHS.map(([name, month]) => ({ name, month, hijri: false })),
  ].sort((left, right) => right.name.length - left.name.length);
  for (const entry of months) {
    const match = text.match(
      new RegExp(
        `(?:(\\d{1,2})\\s+)?(?<![\\p{L}])${entry.name}(?![\\p{L}])(?:\\s+(\\d{1,2}))?\\s+(\\d{4})(?!\\d)`,
        "u",
      ),
    );
    if (!match) continue;
    const day = Number(match[1] || match[2]);
    const year = Number(match[3]);
    if (!day) continue;
    if (entry.hijri || isHijriYear(year)) return hijriToIso(year, entry.month, day);
    return formatGregorian(year, entry.month, day);
  }
  return "";
}

/** Converts a printed date into the yyyy-mm-dd value required by a date input. */
export function toReportDateInputValue(value: string) {
  const text = normalizeDateText(value);
  if (!text) return "";
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s].*)?$/);
  if (iso) {
    const year = Number(iso[1]);
    if (isHijriYear(year)) return hijriToIso(year, Number(iso[2]), Number(iso[3]));
    return formatGregorian(year, Number(iso[2]), Number(iso[3]));
  }
  const forceHijri = /(?:هـ|هجري|hijri)/u.test(text);
  const numeric = text.match(/(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})/u);
  if (numeric) {
    return fromNumericDate(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]), forceHijri);
  }
  return fromNamedDate(text);
}
