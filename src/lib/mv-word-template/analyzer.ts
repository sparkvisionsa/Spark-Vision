import mammoth from "mammoth";
import PizZip from "pizzip";
import {
  MV_WORD_IMAGE_LOOP_TAGS,
  MV_WORD_MERGE_FIELDS,
  resolveFieldByAlias,
  type MvWordMergeFieldKey,
} from "./fields";

export type MvWordTemplateAnalysis = {
  placeholders: string[];
  matchedFields: Array<{ tag: string; fieldKey: MvWordMergeFieldKey; labelAr: string }>;
  unknownTags: string[];
  plainTextPreview: string;
  suggestedMappings: Array<{ snippet: string; fieldKey: MvWordMergeFieldKey; confidence: number }>;
  imageLoopsFound: string[];
};

const PLACEHOLDER_RE = /\{\{([#/]?[@]?[^}]+)\}\}/g;

export function normalizeBrokenDocxTags(xml: string): string {
  return xml.replace(/\{\{([^}]*?)<\/w:t><w:t[^>]*>([^}]*?)\}\}/g, "{{$1$2}}");
}

export function extractPlaceholdersFromDocxXml(xml: string): string[] {
  const found = new Set<string>();
  const matches = xml.matchAll(PLACEHOLDER_RE);
  for (const match of matches) {
    const raw = match[1]?.trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("/")) continue;
    const tag = raw.replace(/^@/, "").trim();
    if (tag) found.add(tag);
  }
  return [...found];
}

export async function analyzeWordTemplate(buffer: ArrayBuffer): Promise<MvWordTemplateAnalysis> {
  const zip = new PizZip(buffer);
  const documentXml = zip.file("word/document.xml")?.asText() ?? "";
  const normalizedXml = normalizeBrokenDocxTags(documentXml);
  const placeholders = extractPlaceholdersFromDocxXml(normalizedXml);

  const mammothResult = await mammoth.extractRawText({ arrayBuffer: buffer });
  const plainTextPreview = mammothResult.value.trim().slice(0, 12_000);

  const matchedFields: MvWordTemplateAnalysis["matchedFields"] = [];
  const unknownTags: string[] = [];

  for (const tag of placeholders) {
    if (tag === MV_WORD_IMAGE_LOOP_TAGS.assetImages.tag || tag === MV_WORD_IMAGE_LOOP_TAGS.valuationImages.tag) {
      continue;
    }
    const field = resolveFieldByAlias(tag);
    if (field) {
      matchedFields.push({ tag, fieldKey: field.key, labelAr: field.labelAr });
    } else {
      unknownTags.push(tag);
    }
  }

  const suggestedMappings = suggestLabelMappings(plainTextPreview);

  const imageLoopsFound: string[] = [];
  if (normalizedXml.includes("{{#assetImages}}") || normalizedXml.includes("#assetImages")) {
    imageLoopsFound.push(MV_WORD_IMAGE_LOOP_TAGS.assetImages.tag);
  }
  if (normalizedXml.includes("{{#valuationImages}}") || normalizedXml.includes("#valuationImages")) {
    imageLoopsFound.push(MV_WORD_IMAGE_LOOP_TAGS.valuationImages.tag);
  }

  return {
    placeholders,
    matchedFields,
    unknownTags,
    plainTextPreview,
    suggestedMappings,
    imageLoopsFound,
  };
}

function suggestLabelMappings(plainText: string): MvWordTemplateAnalysis["suggestedMappings"] {
  const suggestions: MvWordTemplateAnalysis["suggestedMappings"] = [];
  if (!plainText.trim()) return suggestions;

  for (const field of MV_WORD_MERGE_FIELDS) {
    for (const pattern of field.labelPatterns) {
      const re = new RegExp(pattern.source, pattern.flags);
      if (re.test(plainText)) {
        suggestions.push({
          snippet: field.labelAr,
          fieldKey: field.key,
          confidence: 0.82,
        });
        break;
      }
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
