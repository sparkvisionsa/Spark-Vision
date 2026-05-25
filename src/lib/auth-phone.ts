export const DEFAULT_COUNTRY_DIAL_CODE = "+966";

export type CountryDialCode = {
  iso2: string;
  nameAr: string;
  dialCode: string;
};

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { iso2: "SA", nameAr: "السعودية", dialCode: "+966" },
  { iso2: "AE", nameAr: "الإمارات", dialCode: "+971" },
  { iso2: "KW", nameAr: "الكويت", dialCode: "+965" },
  { iso2: "BH", nameAr: "البحرين", dialCode: "+973" },
  { iso2: "QA", nameAr: "قطر", dialCode: "+974" },
  { iso2: "OM", nameAr: "عمان", dialCode: "+968" },
  { iso2: "EG", nameAr: "مصر", dialCode: "+20" },
  { iso2: "JO", nameAr: "الأردن", dialCode: "+962" },
  { iso2: "LB", nameAr: "لبنان", dialCode: "+961" },
  { iso2: "US", nameAr: "أمريكا", dialCode: "+1" },
  { iso2: "GB", nameAr: "بريطانيا", dialCode: "+44" },
  { iso2: "IN", nameAr: "الهند", dialCode: "+91" },
  { iso2: "PK", nameAr: "باكستان", dialCode: "+92" },
];

const COUNTRY_DIAL_CODES_BY_LENGTH = [...COUNTRY_DIAL_CODES].sort(
  (left, right) => right.dialCode.length - left.dialCode.length
);

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function hasRawIdentifierText(value: string) {
  return /[A-Za-z_]/.test(value);
}

export function composeInternationalPhone(
  dialCode: string,
  value: string,
  options: { allowRawIdentifier?: boolean } = {}
) {
  const trimmed = value.replace(/\u0000/g, "").trim();
  if (!trimmed) return "";
  if (options.allowRawIdentifier && hasRawIdentifierText(trimmed)) {
    return trimmed;
  }

  const dialDigits = digitsOnly(dialCode || DEFAULT_COUNTRY_DIAL_CODE);
  let valueDigits = digitsOnly(trimmed);
  if (!valueDigits) return "";
  if (trimmed.startsWith("00") && valueDigits.startsWith("00")) {
    valueDigits = valueDigits.slice(2);
  }
  if (valueDigits.startsWith(dialDigits)) {
    return `+${valueDigits}`;
  }
  if (valueDigits.startsWith("0")) {
    valueDigits = valueDigits.slice(1);
  }
  return `+${dialDigits}${valueDigits}`;
}

export function splitInternationalPhone(value: string) {
  const trimmed = value.replace(/\u0000/g, "").trim();
  if (!trimmed || hasRawIdentifierText(trimmed)) {
    return {
      countryCode: DEFAULT_COUNTRY_DIAL_CODE,
      nationalNumber: trimmed,
    };
  }

  let digits = digitsOnly(trimmed);
  if (trimmed.startsWith("00") && digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  const country = COUNTRY_DIAL_CODES_BY_LENGTH.find((item) =>
    digits.startsWith(digitsOnly(item.dialCode))
  );
  if (!country) {
    return {
      countryCode: DEFAULT_COUNTRY_DIAL_CODE,
      nationalNumber: digits,
    };
  }

  return {
    countryCode: country.dialCode,
    nationalNumber: digits.slice(digitsOnly(country.dialCode).length),
  };
}

export function isInternationalPhone(value: string) {
  const trimmed = value.trim();
  const normalized = composeInternationalPhone(DEFAULT_COUNTRY_DIAL_CODE, trimmed);
  return /^\+[1-9]\d{5,14}$/.test(normalized) && (trimmed.startsWith("+") || trimmed.startsWith("00"));
}
