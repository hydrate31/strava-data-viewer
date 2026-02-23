const SAFE_CHARS = /[^a-zA-Z0-9_-]/g;

export const resolveUserFolder = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "export";

  const normalized = raw
    .replaceAll(" ", "-")
    .replace(SAFE_CHARS, "-")
    .replaceAll("--", "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

  if (!normalized) return "export";
  return normalized.slice(0, 80);
};
