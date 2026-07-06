import { NextResponse } from "next/server";
import { z } from "zod";
import { ai } from "@/ai/genkit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  fileName: z.string().max(240),
  pageCount: z.number().int().min(1).max(500).optional(),
  text: z.string().min(20).max(60_000),
  visualSummary: z
    .object({
      dominantColors: z.array(z.string()).max(12).optional(),
      fontNames: z.array(z.string()).max(20).optional(),
      pageSize: z
        .object({
          width: z.number().optional(),
          height: z.number().optional(),
          orientation: z.enum(["portrait", "landscape", "mixed"]).optional(),
        })
        .optional(),
      hasCoverImage: z.boolean().optional(),
      hasPageImage: z.boolean().optional(),
      hasLandscapePageImage: z.boolean().optional(),
    })
    .optional(),
});

const AiTemplateAnalysisSchema = z.object({
  name: z.string(),
  analysisSummary: z.string(),
  theme: z.object({
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    fontFamily: z.string().optional(),
    visualIdentity: z.string().optional(),
    logo: z.string().optional(),
    watermark: z.string().optional(),
  }),
  layout: z.object({
    pageSize: z.string().optional(),
    orientation: z.enum(["portrait", "landscape", "mixed"]).optional(),
    margins: z.string().optional(),
    header: z.string().optional(),
    footer: z.string().optional(),
    tableStyle: z.string().optional(),
    imagePlacement: z.string().optional(),
    signaturePlacement: z.string().optional(),
    tableOfContents: z.string().optional(),
  }),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      order: z.number(),
      description: z.string().optional(),
      dynamicVariables: z.array(z.string()).optional(),
    }),
  ),
  dynamicVariables: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      source: z.string(),
      required: z.boolean().optional(),
    }),
  ),
  rules: z.array(z.string()),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const prompt = [
      "أنت خبير في تحليل تقارير تقييم الآلات والمعدات وتحويلها إلى قالب JSON قابل لإعادة الاستخدام.",
      "حلل نص PDF المرفوع واستخرج هوية بصرية، تخطيط، ترتيب أقسام، متغيرات ديناميكية، وقواعد تعبئة.",
      "ركّز على أن القالب النهائي يجب أن يحافظ على شكل PDF الأصلي: الغلاف، خلفيات الصفحات، الألوان، الخطوط، الهيدر، الفوتر، الجداول، أماكن الصور والتوقيعات.",
      "المتغيرات يجب أن تعتمد على بيانات مشروع التقييم الحالية: البيانات الأساسية، صور الأصول، صور حسابات القيمة، إعداد التقرير، والتوقيعات.",
      "لا تخترع أرقاما أو بيانات مشروع. استخرج فقط بنية القالب وقواعد الدمج.",
      `اسم الملف: ${body.fileName}`,
      `عدد الصفحات: ${body.pageCount ?? "غير معروف"}`,
      `ملخص بصري مستخرج من PDF:\n${JSON.stringify(body.visualSummary ?? {}, null, 2)}`,
      `نص التقرير:\n${body.text.slice(0, 50_000)}`,
    ].join("\n\n");

    const result = await ai.generate({
      prompt,
      output: {
        format: "json",
        schema: AiTemplateAnalysisSchema,
      },
    });

    const template = result.output;
    if (!template) {
      throw new Error("لم يرجع نموذج الذكاء الاصطناعي قالبا صالحا.");
    }

    return NextResponse.json({ template });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحليل قالب PDF بالذكاء الاصطناعي.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
