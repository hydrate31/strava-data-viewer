import colors from "npm:colors";
import { StravaDataService } from "../../strava.data.service/index.ts";
import { fileExists } from "../../strava.export-data-reader/helpers/fileExists.ts";
import { IActivity } from "../../strava.export-data-reader/interface/activity.ts";
import { IMedia } from "../../strava.export-data-reader/interface/media.ts";

export type IssueSeverity = "critical" | "warning" | "info";

export type QualityIssue = {
  key:
    | "duplicate_activities"
    | "missing_timestamps"
    | "missing_coordinates"
    | "malformed_records"
    | "orphan_media";
  label: string;
  severity: IssueSeverity;
  description: string;
  count: number;
  samples: string[];
  fixAction:
    | "dedupe_activities"
    | "repair_timestamps"
    | "remove_orphan_media"
    | "remove_malformed_records"
    | null;
};

type DataQualityReport = {
  generatedAt: string;
  issues: QualityIssue[];
};

const toValidDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const normalizeActivityFileKey = (activity: IActivity): string => {
  const filename = String(activity.filename ?? "").trim();
  if (!filename) return String(activity.activity_id ?? "").trim();

  const basename = filename.split("/").pop() ?? filename;
  return basename.replace(/\.(gpx|fit|gz)$/i, "").trim() ||
    String(activity.activity_id ?? "").trim();
};

const activityFileExists = async (folder: string, fileKey: string) => {
  if (!fileKey) return false;
  return await fileExists(`./data/${folder}/activities/${fileKey}.gpx`) ||
    await fileExists(`./data/${folder}/activities/${fileKey}.fit`) ||
    await fileExists(`./data/${folder}/activities/${fileKey}.gz`);
};

export const detectQualityIssues = async (
  folder: string,
  strava: StravaDataService,
  onProgress?: (percentage: number) => Promise<void>,
  throwIfCancelled?: () => Promise<void>,
): Promise<QualityIssue[]> => {
  const activities = await strava.activities.list();
  const media = await strava.profile.getMedia().catch(() => [] as IMedia[]);

  const duplicatesById = new Map<string, number>();
  const missingTimestampIds: string[] = [];
  const malformedIds: string[] = [];
  const missingCoordinateIds: string[] = [];

  const activityIds = new Set<string>();
  const activityFilenameRefs = new Set<string>();

  const totalActivities = Math.max(activities.length, 1);

  let index = 0;
  for (const activity of activities) {
    index += 1;
    await throwIfCancelled?.();

    const id = String(activity.activity_id ?? "").trim();
    if (id) {
      activityIds.add(id);
      duplicatesById.set(id, (duplicatesById.get(id) ?? 0) + 1);
    }

    const key = normalizeActivityFileKey(activity);
    if (key) activityFilenameRefs.add(key);

    const activityDate = toValidDate(activity.activity_date);
    const startTime = toValidDate(activity.start_time);
    if (!activityDate && !startTime) {
      missingTimestampIds.push(id || key || "(missing id)");
    }

    const hasInvalidActivityDate =
      !!String(activity.activity_date ?? "").trim() &&
      !activityDate;
    const hasInvalidStartTime = !!String(activity.start_time ?? "").trim() &&
      !startTime;
    if (!id || hasInvalidActivityDate || hasInvalidStartTime) {
      malformedIds.push(key || "(missing id)");
    }

    const hasFile = await activityFileExists(folder, key);
    if (!hasFile) {
      missingCoordinateIds.push(id || key || "(missing id)");
    }

    if (onProgress && (index % 25 === 0 || index === activities.length)) {
      await onProgress((index / totalActivities) * 90);
    }
  }

  await throwIfCancelled?.();
  if (onProgress) await onProgress(95);

  const duplicateIds = [...duplicatesById.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  const orphanMedia: string[] = [];
  for (const item of media) {
    await throwIfCancelled?.();

    const filename = String(item.filename ?? "").trim();
    if (!filename) continue;

    const base = filename.split("/").pop()?.replace(/\.[^.]+$/, "") ?? filename;
    const idMatch = base.match(/(\d{5,})/);
    const inferredId = idMatch?.[1] ?? "";

    const linkedById = inferredId ? activityIds.has(inferredId) : false;
    const linkedByFilename = activityFilenameRefs.has(base) ||
      activityFilenameRefs.has(filename);

    if (!linkedById && !linkedByFilename) {
      orphanMedia.push(filename);
    }
  }

  const unique = (values: string[]) => [...new Set(values)];

  return [
    {
      key: "duplicate_activities",
      label: "Duplicate activities",
      severity: "critical",
      description:
        "Multiple rows share the same activity_id in activities.csv.",
      count: duplicateIds.length,
      samples: duplicateIds.slice(0, 8),
      fixAction: duplicateIds.length > 0 ? "dedupe_activities" : null,
    },
    {
      key: "missing_timestamps",
      label: "Missing timestamps",
      severity: "warning",
      description:
        "Rows missing both activity_date and start_time, or dates are invalid.",
      count: unique(missingTimestampIds).length,
      samples: unique(missingTimestampIds).slice(0, 8),
      fixAction: unique(missingTimestampIds).length > 0
        ? "repair_timestamps"
        : null,
    },
    {
      key: "missing_coordinates",
      label: "Missing coordinates",
      severity: "warning",
      description:
        "Activity file missing (.gpx/.fit/.gz not found for the activity).",
      count: unique(missingCoordinateIds).length,
      samples: unique(missingCoordinateIds).slice(0, 8),
      fixAction: null,
    },
    {
      key: "malformed_records",
      label: "Malformed activity records",
      severity: "critical",
      description:
        "Activity rows missing required identifiers (activity_id) or containing invalid dates.",
      count: unique(malformedIds).length,
      samples: unique(malformedIds).slice(0, 8),
      fixAction: unique(malformedIds).length > 0
        ? "remove_malformed_records"
        : null,
    },
    {
      key: "orphan_media",
      label: "Orphan media",
      severity: "info",
      description:
        "media.csv rows not linked to any known activity by id/filename.",
      count: unique(orphanMedia).length,
      samples: unique(orphanMedia).slice(0, 8),
      fixAction: unique(orphanMedia).length > 0 ? "remove_orphan_media" : null,
    },
  ];
};

export const dataQuality = {
  scan: async (
    folder: string,
    strava: StravaDataService,
    onProgress?: (percentage: number) => Promise<void>,
    throwIfCancelled?: () => Promise<void>,
  ) => {
    console.log(colors.blue("::Task::") + "Scanning Data Quality");

    await throwIfCancelled?.();
    if (onProgress) await onProgress(1);

    const issues = await detectQualityIssues(
      folder,
      strava,
      onProgress,
      throwIfCancelled,
    );

    await throwIfCancelled?.();

    const report: DataQualityReport = {
      generatedAt: new Date().toISOString(),
      issues,
    };

    await Deno.writeTextFile(
      `./data/${folder}/data-quality-report.json`,
      JSON.stringify(report, null, 2),
    );

    if (onProgress) await onProgress(100);
  },
};
