function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** أنماط استبدال: نفس السطر، أو السطر التالي (شائع في تقارير Word) */
export function buildLabelPatterns(labels: string[]): RegExp[] {
  return labels.flatMap((text) => {
    const escaped = escapeRegExp(text);
    return [
      new RegExp(`(${escaped}\\s*[:：]?\\s*)([^\\n\\r]{1,4000})`, "gi"),
      new RegExp(`(${escaped}\\s*[:：]?\\s*[\\n\\r]+\\s*)([^\\n\\r]{1,4000})`, "gi"),
    ];
  });
}
