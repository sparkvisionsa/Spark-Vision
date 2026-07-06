import { NextResponse } from "next/server";
import { z } from "zod";
import { ai } from "@/ai/genkit";
import { MV_WORD_MERGE_FIELDS } from "@/lib/mv-word-template/fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  unknownTags: z.array(z.string().max(120)).max(80),
  plainTextPreview: z.string().max(14_000),
});

const FIELD_KEYS = MV_WORD_MERGE_FIELDS.map((field) => ({
  key: field.key,
  labelAr: field.labelAr,
  aliases: field.aliases.slice(0, 4),
}));

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = BodySchema.parse(json);
    if (body.unknownTags.length === 0) {
      return NextResponse.json({ mappings: [] });
    }

    const prompt = [
      "أنت خبير في قوالب تقارير التقييم العقاري والآلات بالعربية.",
      "اربط كل علامة دمج غير معروفة بأقرب حقل نظام من القائمة، أو اترك fieldKey فارغاً إن لم يوجد تطابق معقول.",
      "أعد JSON فقط بالشكل: {\"mappings\":[{\"tag\":\"...\",\"fieldKey\":\"... أو null\",\"confidence\":0.0-1.0,\"reason\":\"...\"}]}",
      `الحقول المتاحة: ${JSON.stringify(FIELD_KEYS)}`,
      `العلامات غير المعروفة: ${JSON.stringify(body.unknownTags)}`,
      `مقتطف من نص القالب:\n${body.plainTextPreview.slice(0, 6000)}`,
    ].join("\n\n");

    const result = await ai.generate({
      prompt,
      output: {
        format: "json",
        schema: z.object({
          mappings: z.array(
            z.object({
              tag: z.string(),
              fieldKey: z.string().nullable(),
              confidence: z.number().min(0).max(1),
              reason: z.string(),
            }),
          ),
        }),
      },
    });

    const mappings = result.output?.mappings ?? [];
    return NextResponse.json({ mappings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحليل القالب بالذكاء الاصطناعي.";
    return NextResponse.json({ message, mappings: [] }, { status: 500 });
  }
}
