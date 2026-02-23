export const parseDateInput = (
  value: string | number | Date | null | undefined,
): Date | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date;
};

export const formatAbsoluteDate = (
  value: string | number | Date | null | undefined,
): string => {
  const date = parseDateInput(value);
  if (!date) return "-";
  return date.toLocaleString();
};

export const formatTimeAgo = (
  value: string | number | Date | null | undefined,
  nowMs = Date.now(),
): string => {
  const date = parseDateInput(value);
  if (!date) return "-";

  const seconds = Math.round((date.getTime() - nowMs) / 1000);
  const absSeconds = Math.abs(seconds);

  if (absSeconds < 5) return "just now";

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  for (const [unit, unitSeconds] of units) {
    if (absSeconds >= unitSeconds || unit === "second") {
      const delta = Math.round(seconds / unitSeconds);
      return rtf.format(delta, unit);
    }
  }

  return "just now";
};
