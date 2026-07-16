"use client";

/**
 * أدوات مساعدة لتركيب صفحات التقرير النهائي من قالب ذكاء اصطناعي (AI) مُستخرج من
 * ملف PDF مرفوع — بدل استخدام لقطة شاشة ثابتة لصفحة من الملف الأصلي كخلفية (وهو ما
 * كان يسبب تراكب النص القديم مع محتوى القسم الديناميكي)، نبني قائمة الأقسام الفعلية
 * لصفحات التقرير من `aiTemplate.sections`:
 *
 * - كل قسم AI يُطابَق — عبر عناوينه/وصفه — بموضوع من الأقسام الافتراضية الموثوقة
 *   الموجودة أصلاً (`topicSections` في `mv-valuation-report-document-body.tsx`)،
 *   فيُعرض محتواها الحقيقي المرتبط ببيانات المشروع كما هو تماماً.
 * - أي قسم AI لا يطابق موضوعاً معروفاً يُعرض كقسم عام (عنوان + وصف AI + متغيرات
 *   ديناميكية محلولة من بيانات المشروع الحقيقية — لا نص ثابت مُخترَع).
 * - أي موضوع افتراضي لم يُذكر في قالب AI لا يُعرض إطلاقاً — وهذا ما "يُخفي" القالب
 *   الأساسي فعلياً عند تفعيل قالب AI، بدل تراكب الاثنين.
 */

import type { ReactNode } from "react";
import type { MvCompanyAiReportTemplate, MvCompanyAiReportTemplateSection } from "./types";
import { MV_REPORT_TOC_ROWS, type MvReportTocRow } from "./mv-valuation-report-toc";

export type MvAiReportTopicKey =
  | "intro"
  | "datesUsed"
  | "compliance"
  | "independence"
  | "valuerIdentity"
  | "clientIdentity"
  | "intendedUsers"
  | "assetSummary"
  | "scopeOfWork"
  | "valuationPurpose"
  | "intendedUse"
  | "valuationBasis"
  | "valuePremise"
  | "useRestriction"
  | "externalSpecialists"
  | "esg"
  | "reportType"
  | "informationSources"
  | "assetSubject"
  | "partialDescription"
  | "exclusions"
  | "currency"
  | "valuationProcedures"
  | "inspection"
  | "methodologyRationale"
  | "costApproach"
  | "assumptions"
  | "valueOpinion";

interface TopicRule {
  topic: MvAiReportTopicKey | "skip";
  patterns: RegExp[];
}

/**
 * anchor الموضوع الافتراضي المطابق — يُستخدم فقط لبناء فهرس (TOC) دقيق ومرقّم تسلسلياً
 * عند تفعيل قالب AI (بدل الفهرس الثابت الذي يسرد كل الأقسام الافتراضية الـ27 دوماً بلا
 * اعتبار لأيها ظهر فعلاً في المتن — وهو ما كان يجعل الفهرس غير مطابق للمحتوى الحقيقي).
 */
const TOPIC_ANCHOR: Record<MvAiReportTopicKey, string> = {
  intro: "mv-toc-1",
  datesUsed: "mv-toc-2",
  compliance: "mv-toc-3",
  independence: "mv-toc-4",
  valuerIdentity: "mv-toc-5",
  clientIdentity: "mv-toc-6",
  intendedUsers: "mv-toc-7",
  assetSummary: "mv-toc-asset-summary",
  scopeOfWork: "mv-toc-8",
  valuationPurpose: "mv-toc-9",
  intendedUse: "mv-toc-10",
  valuationBasis: "mv-toc-11",
  valuePremise: "mv-toc-12",
  useRestriction: "mv-toc-13",
  externalSpecialists: "mv-toc-14",
  esg: "mv-toc-15",
  reportType: "mv-toc-16",
  informationSources: "mv-toc-17",
  assetSubject: "mv-toc-18",
  partialDescription: "mv-toc-18-1",
  exclusions: "mv-toc-exclusions",
  currency: "mv-toc-19",
  valuationProcedures: "mv-toc-procedures",
  inspection: "mv-toc-20",
  methodologyRationale: "mv-toc-21",
  costApproach: "mv-toc-22",
  assumptions: "mv-toc-23",
  valueOpinion: "mv-toc-24",
};

function tocTitleForAnchor(anchor: string): string {
  return MV_REPORT_TOC_ROWS.find((row) => row.anchor === anchor)?.title ?? anchor;
}

/**
 * جدول مطابقة الكلمات المفتاحية — الترتيب مهم (الأكثر تحديداً أولاً). لا توجد قاعدة
 * مخصصة لـ `assetSummary` عمداً: عنوانها الافتراضي مطابق حرفياً لعنوان `assetSubject`
 * ("الأصل محل التقييم")، فيبقى قابلاً للاستخدام فقط ضمن الترتيب الافتراضي (غير AI)
 * لتفادي التطابق الملتبس بين قسمين مختلفين بعنوان واحد.
 */
const TOPIC_RULES: TopicRule[] = [
  { topic: "skip", patterns: [/غلاف/, /هوية بصرية/, /\bcover\s*page\b/i, /^\s*cover\s*$/i] },
  { topic: "skip", patterns: [/فهرس/, /المحتويات/, /\btable of contents\b/i, /\bcontents\b/i, /\bindex\b/i] },
  { topic: "compliance", patterns: [/الامتثال/, /معايير التقييم/, /\bcompliance\b/i, /\bivs\b/, /international valuation standards/i] },
  { topic: "independence", patterns: [/الاستقلالية/, /تضارب المصالح/, /\bindependence\b/i, /conflict of interest/i] },
  { topic: "valuerIdentity", patterns: [/هوية المقيم/, /valuer identity/i, /\bappraiser\b/i] },
  { topic: "clientIdentity", patterns: [/هوية العميل/, /client identity/i] },
  { topic: "intendedUsers", patterns: [/مستخدمين مقصودين/, /other intended users/i, /intended users/i] },
  { topic: "scopeOfWork", patterns: [/نطاق العمل/, /scope of work/i] },
  { topic: "valuationPurpose", patterns: [/الغرض من التقييم/, /purpose of (the )?valuation/i] },
  { topic: "intendedUse", patterns: [/الاستخدام المقصود/, /intended use/i] },
  { topic: "valuationBasis", patterns: [/أساس القيمة/, /basis of value/i] },
  { topic: "valuePremise", patterns: [/فرضية القيمة/, /premise of value/i] },
  { topic: "useRestriction", patterns: [/القيود على استخدام/, /restrictions? on use/i] },
  { topic: "externalSpecialists", patterns: [/الاستعانة بأخصائيين/, /external specialists?/i] },
  { topic: "esg", patterns: [/البيئية والاجتماعية والحوكمة/, /\besg\b/i] },
  { topic: "reportType", patterns: [/نوع التقرير/, /report type/i] },
  { topic: "informationSources", patterns: [/مصادر المعلومات/, /information sources/i] },
  { topic: "partialDescription", patterns: [/الوصف الجزئي/, /detailed description/i] },
  { topic: "assetSubject", patterns: [/الأصل محل التقييم/, /asset(s)? subject/i, /subject asset/i] },
  { topic: "exclusions", patterns: [/الاستثناءات/, /exclusions?/i] },
  { topic: "currency", patterns: [/العملة/, /\bcurrency\b/i] },
  { topic: "valuationProcedures", patterns: [/إجراءات التقييم/, /valuation procedures/i] },
  { topic: "inspection", patterns: [/المعاينة/, /\binspection\b/i] },
  { topic: "methodologyRationale", patterns: [/منهجية التقييم/, /\bmethodology\b/i] },
  { topic: "costApproach", patterns: [/تطبيق أسلوب التقييم/, /أسلوب التكلفة/, /cost approach/i, /valuation approach/i] },
  { topic: "assumptions", patterns: [/الافتراضات/, /assumptions?/i] },
  { topic: "valueOpinion", patterns: [/رأي القيمة/, /التوقيع/, /opinion of value/i, /conclusion of value/i, /\bsignature/i] },
  { topic: "datesUsed", patterns: [/التواريخ المستخدمة/, /dates used/i] },
  { topic: "intro", patterns: [/مقدمة/, /\bintroduction\b/i] },
];

function aiSectionMatchText(section: MvCompanyAiReportTemplateSection): string {
  return [section.title, section.id, section.description].filter(Boolean).join(" ");
}

/** يُطابق قسماً واحداً من قالب AI بموضوع معروف، أو `"skip"` (غلاف/فهرس)، أو `null` إن لم يطابق أي شيء. */
export function matchAiSectionTopic(section: MvCompanyAiReportTemplateSection): MvAiReportTopicKey | "skip" | null {
  const text = aiSectionMatchText(section);
  if (!text.trim()) return null;
  for (const rule of TOPIC_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.topic;
  }
  return null;
}

/** القيم الحقيقية المتاحة لحل متغيرات قالب AI الديناميكية — كلها مشتقة من بيانات المشروع/التقرير/الشركة الفعلية. */
export interface MvAiVariableContext {
  projectName: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  companyName: string;
  valuationDateDisplay: string;
  reportIssueDateDisplay: string;
  inspectionDateDisplay: string;
  finalValueDisplay: string;
  finalValueWords: string;
  currencyLabel: string;
  reportReference: string;
  reportTitle: string;
  leadValuerName: string;
  assetFolderLabelsText: string;
  assetImagesCountText: string;
  valuationImagesCountText: string;
  signatoryNamesText: string;
}

type VariableResolver = (ctx: MvAiVariableContext) => string | null | undefined;

function normalizeSourceKey(source: string): string {
  return source.toLowerCase().replace(/[^a-z.]/g, "");
}

/** مصادر معروفة (بصيغ dotted أو مفاتيح مباشرة) → قيمة حقيقية من سياق المشروع. مصدر غير معروف = `null` دائماً (لا بيانات مُخترَعة). */
const VARIABLE_RESOLVERS: Record<string, VariableResolver> = {
  "project.name": (ctx) => ctx.projectName,
  projectname: (ctx) => ctx.projectName,
  "project.clientname": (ctx) => ctx.clientName,
  clientname: (ctx) => ctx.clientName,
  "project.clientphone": (ctx) => ctx.clientPhone,
  clientphone: (ctx) => ctx.clientPhone,
  "project.clientemail": (ctx) => ctx.clientEmail,
  clientemail: (ctx) => ctx.clientEmail,
  "company.name": (ctx) => ctx.companyName,
  companyname: (ctx) => ctx.companyName,
  "reportdata.valuationdate": (ctx) => ctx.valuationDateDisplay,
  valuationdate: (ctx) => ctx.valuationDateDisplay,
  "reportdata.reportdate": (ctx) => ctx.reportIssueDateDisplay,
  "reportdata.reportissuedate": (ctx) => ctx.reportIssueDateDisplay,
  reportdate: (ctx) => ctx.reportIssueDateDisplay,
  "reportdata.inspectiondate": (ctx) => ctx.inspectionDateDisplay,
  inspectiondate: (ctx) => ctx.inspectionDateDisplay,
  "reportdata.finalvalue": (ctx) => ctx.finalValueDisplay,
  finalvalue: (ctx) => ctx.finalValueDisplay,
  "reportdata.finalvaluewords": (ctx) => ctx.finalValueWords,
  finalvaluewords: (ctx) => ctx.finalValueWords,
  "reportdata.currency": (ctx) => ctx.currencyLabel,
  "reportdata.currencylabel": (ctx) => ctx.currencyLabel,
  currency: (ctx) => ctx.currencyLabel,
  "reportdata.reportreference": (ctx) => ctx.reportReference,
  reportreference: (ctx) => ctx.reportReference,
  "reportdata.reporttitle": (ctx) => ctx.reportTitle,
  reporttitle: (ctx) => ctx.reportTitle,
  "reportdata.leadvaluername": (ctx) => ctx.leadValuerName,
  leadvaluername: (ctx) => ctx.leadValuerName,
  "project.assets": (ctx) => ctx.assetFolderLabelsText,
  assetstable: (ctx) => ctx.assetFolderLabelsText,
  assetfolders: (ctx) => ctx.assetFolderLabelsText,
  "project.assetimages": (ctx) => ctx.assetImagesCountText,
  assetimages: (ctx) => ctx.assetImagesCountText,
  "project.valuationaccountingworkspace.images": (ctx) => ctx.valuationImagesCountText,
  valuationcalculationimages: (ctx) => ctx.valuationImagesCountText,
  "company.reportsignatoryrows": (ctx) => ctx.signatoryNamesText,
  signatories: (ctx) => ctx.signatoryNamesText,
  signatoryrows: (ctx) => ctx.signatoryNamesText,
};

/** يحل مصدر متغير AI واحد (مثل `project.clientName`) إلى قيمة نصية حقيقية، أو `null` إن كان المصدر غير معروف أو القيمة فارغة. */
export function resolveAiVariable(source: string | undefined, ctx: MvAiVariableContext): string | null {
  if (!source) return null;
  const resolver = VARIABLE_RESOLVERS[normalizeSourceKey(source)];
  if (!resolver) return null;
  const value = resolver(ctx);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * تُطابق تصميم `sectionHeading` الافتراضي في `mv-valuation-report-document-body.tsx`
 * حرفياً (نفس الخط/اللون/الفاصل الذهبي) — بلا أي تلوين مستمد من قالب AI. الهدف اتساق
 * بصري كامل مع بقية التقرير المهني بصرف النظر عن تصميم/ألوان الملف المرفوع.
 */
function AiSectionHeading({ title }: { title: string }) {
  return (
    <div
      dir="rtl"
      className="mb-3 flex items-stretch gap-2 border-b border-[#0C447C]/35 pb-2 text-right font-black leading-snug text-[#0C447C]"
      style={{ fontSize: "calc(17px * var(--mv-heading-scale, 1))" }}
    >
      <span aria-hidden className="w-[3px] shrink-0 rounded-sm bg-gradient-to-b from-[#c9a227] via-[#d4af3e] to-[#9b7a17]" />
      <div className="min-w-0 flex-1 pt-[2px]">
        <span className="tracking-tight">{title}</span>
      </div>
    </div>
  );
}

/**
 * يُركّب قسماً عاماً من بيانات AI (عنوان + وصف كنص متصل + معلومات إضافية إن وُجدت) لقسم
 * AI لا يطابق أي موضوع افتراضي موثوق. يُرجع `null` إن لم يوجد أي محتوى حقيقي (لا وصف
 * ولا متغيرات محلولة) بدل عرض قسم فارغ بعنوان بلا محتوى — وهو مظهر غير مهني.
 */
function renderAiCustomSection(
  section: MvCompanyAiReportTemplateSection,
  variables: MvCompanyAiReportTemplate["dynamicVariables"],
  ctx: MvAiVariableContext,
  index: number,
): { node: ReactNode; anchor: string; title: string } | null {
  const description = section.description?.trim();
  const resolvedVars = (section.dynamicVariables ?? [])
    .map((key) => {
      const def = variables?.find((v) => v.key === key);
      if (!def) return null;
      const value = resolveAiVariable(def.source, ctx);
      if (!value) return null;
      return { label: def.label?.trim() || def.key || "", value };
    })
    .filter((item): item is { label: string; value: string } => Boolean(item));

  if (!description && resolvedVars.length === 0) return null;

  const anchorId = `mv-ai-section-${(section.id?.trim() || String(index + 1)).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const title = section.title?.trim() || `قسم إضافي ${index + 1}`;

  const node = (
    <section key={anchorId} id={anchorId} data-mv-report-insert-anchor={anchorId} className="mt-5 space-y-2">
      <AiSectionHeading title={title} />
      <div
        className="space-y-3 text-[12px] font-medium leading-7 text-slate-800"
        style={{ lineHeight: "var(--mv-paragraph-leading, 1.75)" }}
      >
        {description ? <p className="whitespace-pre-wrap break-words">{description}</p> : null}
        {resolvedVars.length > 0 ? (
          <ul className="list-disc space-y-1.5 pe-4 text-[12px] font-semibold text-slate-800">
            {resolvedVars.map((item, itemIndex) => (
              <li key={`${item.label}-${itemIndex}`}>
                <span className="font-black text-slate-900">{item.label}: </span>
                {item.value}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );

  return { node, anchor: anchorId, title };
}

export interface MvAiReportFlow {
  /** عناصر المتن الفعلية بترتيبها النهائي — تُغذّى مباشرة في `ReportFlowPages`. */
  nodes: ReactNode[];
  /**
   * صفوف فهرس (TOC) مطابقة تماماً لعناصر `nodes` بنفس ترتيبها — بلا ترقيم (يُرقَّم
   * تسلسلياً 1.0، 2.0... عند الاستخدام)، لتفادي فهرس ثابت يسرد كل الأقسام الافتراضية
   * الـ27 دوماً بصرف النظر عمّا ظهر فعلاً في المتن.
   */
  tocRows: MvReportTocRow[];
}

/**
 * يبني قائمة أقسام صفحات التقرير النهائي من قالب AI: يُرتّب `aiTemplate.sections` حسب
 * `order`، ثم لكل قسم يُطابِق موضوعاً معروفاً في `topicSections` يعرض محتواه الموثوق
 * كما هو (أول تطابق لكل موضوع فقط)، وأي قسم غير مطابق يُعرض كقسم AI عام. يُرجع `null`
 * إذا لم يوجد أي قسم في القالب — ليقع مسار العرض على الترتيب الافتراضي كشبكة أمان.
 */
export function buildAiReportFlowChildren({
  aiTemplate,
  topicSections,
  ctx,
}: {
  aiTemplate: MvCompanyAiReportTemplate | null | undefined;
  topicSections: Partial<Record<MvAiReportTopicKey, ReactNode>>;
  ctx: MvAiVariableContext;
}): MvAiReportFlow | null {
  const sections = aiTemplate?.sections;
  if (!sections || sections.length === 0) return null;

  const sorted = sections
    .map((section, index) => ({ section, index }))
    .sort((a, b) => {
      const orderA = typeof a.section.order === "number" ? a.section.order : a.index;
      const orderB = typeof b.section.order === "number" ? b.section.order : b.index;
      return orderA - orderB;
    });

  const seenTopics = new Set<MvAiReportTopicKey>();
  const nodes: ReactNode[] = [];
  const tocRows: MvReportTocRow[] = [];
  let customIndex = 0;

  for (const { section } of sorted) {
    const match = matchAiSectionTopic(section);
    if (match === "skip") continue;
    if (match && !seenTopics.has(match) && topicSections[match]) {
      seenTopics.add(match);
      nodes.push(topicSections[match]);
      const anchor = TOPIC_ANCHOR[match];
      tocRows.push({ num: "", title: tocTitleForAnchor(anchor), anchor });
      continue;
    }
    const custom = renderAiCustomSection(section, aiTemplate?.dynamicVariables, ctx, customIndex);
    if (custom) {
      nodes.push(custom.node);
      tocRows.push({ num: "", title: custom.title, anchor: custom.anchor });
      customIndex += 1;
    }
  }

  return nodes.length > 0 ? { nodes, tocRows } : null;
}
