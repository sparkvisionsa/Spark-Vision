/**
 * حدود حقول الدعم الفني وشارك فكرتك كما يتحقّق منها الخادم في
 * `SparkVision-Backend/src/support/support.types.ts`. أي تعديل هناك يجب أن
 * يقابله تعديل هنا حتى يرى المستخدم الرسالة قبل الإرسال لا بعد رفض الطلب.
 */
export const SUPPORT_SUBJECT_MIN = 3;
export const SUPPORT_SUBJECT_MAX = 160;
export const SUPPORT_AUTO_SUBJECT_WORDS = 3;
export const SUPPORT_TEXT_MAX = 8000;
export const SUPPORT_ATTACHMENTS_MAX = 4;

/** رسالة تشرح ما ينقص عنوان التذكرة، أو نص فارغ إن كان العنوان صالحاً. */
export function ticketSubjectIssue(value: string) {
  const subject = value.trim();
  if (!subject) return "اكتب عنوان التذكرة أو رسالتك.";
  if (subject.length < SUPPORT_SUBJECT_MIN) {
    return `النص قصير جداً؛ اكتب ${SUPPORT_SUBJECT_MIN} أحرف على الأقل.`;
  }
  return "";
}

const TITLE_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "i", "in", "is", "it", "my", "of", "on", "or", "please", "the", "this", "to", "was", "with", "you", "your",
  "أنا", "انت", "أنتم", "أن", "او", "أو", "الى", "إلى", "التي", "الذي", "عن", "على", "في", "من", "مع", "بعد", "قبل", "عند", "لدي", "لديكم", "هذا", "هذه", "ذلك", "تلك", "ثم", "كما", "لكن", "لان", "لأن", "لا", "لم", "لن", "ما", "ماذا", "كيف", "هل", "يرجى", "اريد", "أريد", "احتاج", "أحتاج", "المساعدة", "يمكن", "استطيع", "أستطيع", "مشكلة", "المشكلة", "طلب", "الدعم", "فقط", "جدا", "جداً",
]);

type TitleToken = { raw: string; key: string; stopKey: string; index: number };

function titleTokens(value: string): TitleToken[] {
  const words = value.match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.map((raw, index) => {
    const stopKey = raw.toLocaleLowerCase().replace(/[\u064B-\u065F\u0670]/g, "");
    return {
      raw: raw.slice(0, 48),
      // Treat "صور" and "الصور" as one keyword while preserving the first
      // original form for display in the generated Arabic title.
      key: stopKey.replace(/^ال(?=\p{L})/u, ""),
      stopKey,
      index,
    };
  });
}

/**
 * Selects three content keywords, rather than copying the beginning of the
 * request. Repeated and specific words are ranked highest, then restored to
 * their order in the description so the title remains natural to read.
 */
export function ticketSubjectFromDescription(value: string) {
  const tokens = titleTokens(value);
  const candidates = tokens.filter((token) => token.raw.length >= 2 && !TITLE_STOP_WORDS.has(token.stopKey));
  const pool = candidates.length >= SUPPORT_AUTO_SUBJECT_WORDS ? candidates : tokens;
  const firstByKey = new Map<string, TitleToken>();
  const frequency = new Map<string, number>();
  for (const token of pool) {
    if (!firstByKey.has(token.key)) firstByKey.set(token.key, token);
    frequency.set(token.key, (frequency.get(token.key) ?? 0) + 1);
  }
  return [...firstByKey.values()]
    .sort((left, right) =>
      ((frequency.get(right.key) ?? 0) * 100 + right.raw.length) -
      ((frequency.get(left.key) ?? 0) * 100 + left.raw.length) ||
      left.index - right.index,
    )
    .slice(0, SUPPORT_AUTO_SUBJECT_WORDS)
    .sort((left, right) => left.index - right.index)
    .map((token) => token.raw)
    .join(" ");
}

/** يحوّل حقل إنشاء التذكرة الواحد إلى عنوان مختصر وأول رسالة كاملة. */
export function ticketContentFromRequest(value: string) {
  const text = value.trim();
  return { subject: ticketSubjectFromDescription(text), text };
}

/** العنوان الاختياري: الفراغ مقبول، أما حرف أو حرفان فيرفضهما الخادم. */
export function optionalSubjectIssue(value: string) {
  const subject = value.trim();
  if (subject && subject.length < SUPPORT_SUBJECT_MIN) {
    return `أكمل العنوان إلى ${SUPPORT_SUBJECT_MIN} أحرف على الأقل، أو اتركه فارغاً ليُسمّى الطلب تلقائياً.`;
  }
  return "";
}

/** رسالة تشرح ما ينقص نص التذكرة، أو نص فارغ إن كان النص صالحاً. */
export function ticketTextIssue(value: string) {
  return value.trim() ? "" : "اكتب تفاصيل طلبك أو المشكلة التي واجهتك.";
}

/** عنوان جاهز للإرسال؛ العناوين الأقصر من حد الخادم تُستبدل بعنوان تلقائي. */
export function ticketSubjectOrFallback(value: string, fallback: string) {
  const subject = value.trim();
  return subject.length >= SUPPORT_SUBJECT_MIN ? subject.slice(0, SUPPORT_SUBJECT_MAX) : fallback;
}
