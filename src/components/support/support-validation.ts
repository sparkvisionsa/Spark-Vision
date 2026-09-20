/**
 * حدود حقول الدعم الفني وكن مطور كما يتحقّق منها الخادم في
 * `SparkVision-Backend/src/support/support.types.ts`. أي تعديل هناك يجب أن
 * يقابله تعديل هنا حتى يرى المستخدم الرسالة قبل الإرسال لا بعد رفض الطلب.
 */
export const SUPPORT_SUBJECT_MIN = 3;
export const SUPPORT_SUBJECT_MAX = 160;
export const SUPPORT_TEXT_MAX = 8000;
export const SUPPORT_ATTACHMENTS_MAX = 4;

/** رسالة تشرح ما ينقص عنوان التذكرة، أو نص فارغ إن كان العنوان صالحاً. */
export function ticketSubjectIssue(value: string) {
  const subject = value.trim();
  if (!subject) return "اكتب عنواناً مختصراً يوضح طلبك.";
  if (subject.length < SUPPORT_SUBJECT_MIN) {
    return `العنوان قصير جداً؛ اكتب ${SUPPORT_SUBJECT_MIN} أحرف على الأقل.`;
  }
  return "";
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
