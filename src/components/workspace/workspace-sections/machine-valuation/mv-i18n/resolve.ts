export type MvLang = "ar" | "en";

export function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

export function resolveMvString(
  dict: Record<string, unknown>,
  key: string,
): string | undefined {
  const parts = key.split(".");
  let current: unknown = dict;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function createMvT(dict: Record<string, unknown>) {
  return (key: string, vars?: Record<string, string | number>) => {
    const raw = resolveMvString(dict, key);
    return raw ? interpolate(raw, vars) : key;
  };
}
