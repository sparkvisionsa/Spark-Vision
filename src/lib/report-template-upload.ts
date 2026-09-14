import { inspectDocxTemplate } from "./mv-word-template/template-variables";
import { scanPptxTemplate } from "./mv-pptx-template";

/** Validate before any upload or changes to the stored template catalogue. */
export async function readReportTemplateUpload(file: File, format: "word" | "pptx") {
  const title = format === "word" ? "Word" : "PowerPoint";
  const extension = format === "word" ? ".docx" : ".pptx";
  const limitMb = format === "word" ? 25 : 35;
  if (!file.name.toLowerCase().endsWith(extension)) {
    throw new Error(`يرجى رفع ملف ${title} بصيغة ${extension} فقط.`);
  }
  const emptyMessage = `قالب ${title} فارغ. انسخ المتغيرات المقترحة مثل <<اساس_القيمة>> وأضفها إلى القالب على جهازك، ثم ارفع الملف مجددًا.`;
  if (file.size === 0) throw new Error(emptyMessage);
  if (file.size > limitMb * 1024 * 1024) throw new Error(`حجم قالب ${title} يجب ألا يتجاوز ${limitMb}MB.`);
  const buffer = await file.arrayBuffer();
  let scan: { variables: string[]; hasContent: boolean };
  try {
    if (format === "word") {
      scan = inspectDocxTemplate(buffer);
    } else {
      const pptx = scanPptxTemplate(buffer);
      scan = { ...pptx, variables: [...new Set([...pptx.variables, ...pptx.assetImageMarkerNames])] };
    }
  } catch {
    throw new Error(`تعذر قراءة قالب ${title}. تأكد من أن الملف سليم وغير محمي بكلمة مرور، ثم أعد حفظه بصيغة ${extension} وحاول مجددًا.`);
  }
  if (!scan.hasContent) throw new Error(emptyMessage);
  if (scan.variables.length === 0) {
    throw new Error(`لم نعثر على متغيرات في قالب ${title}. أضف متغيرًا نصيًا بالصيغة <<اساس_القيمة>> باستخدام زر النسخ بجانب الحقل، ثم احفظ القالب وارفعه مجددًا.`);
  }
  if (scan.variables.length > 300 || scan.variables.some((name) => name.length > (format === "word" ? 120 : 160))) {
    throw new Error("يحتوي القالب على متغيرات كثيرة أو أسماء طويلة جدًا. استخدم حتى 300 متغير بأسماء قصيرة أو انسخ الأسماء المقترحة من الجدول.");
  }
  return { buffer, variables: scan.variables };
}
