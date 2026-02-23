import colors from "npm:colors";
import { parse } from "@std/csv/parse";
import { StravaDataService } from "../../strava.data.service/index.ts";
import { fileExists } from "../../strava.export-data-reader/helpers/fileExists.ts";
import activityColumns from "../../strava.export-data-reader/data/activities-columns.ts";
import mediaColumns from "../../strava.export-data-reader/data/media-columns.ts";
import { IActivity } from "../../strava.export-data-reader/interface/activity.ts";
import { IMedia } from "../../strava.export-data-reader/interface/media.ts";
import sdevTasks from "../index.ts";
import { TaskType } from "../interfaces/task-type.ts";
import { QueueEntry } from "../interfaces/queue-entry.ts";

export type DataQualityFixAction =
  | "dedupe_activities"
  | "repair_timestamps"
  | "remove_orphan_media"
  | "remove_malformed_records";

const csvEscape = (value: unknown): string => {
  const text = String(value ?? "");
  if (
    text.includes('"') || text.includes(",") || text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
};

const writeCsv = async <T extends Record<string, unknown>>(
  path: string,
  columns: string[],
  records: T[],
) => {
  const rows = [
    columns.join(","),
    ...records.map((record) =>
      columns.map((column) => csvEscape(record[column])).join(",")
    ),
  ];
  await Deno.writeTextFile(path, `${rows.join("\n")}\n`);
};

const readCsv = async <T>(
  path: string,
  columns: string[],
): Promise<T[]> => {
  if (!await fileExists(path)) return [];
  const text = await Deno.readTextFile(path);
  return parse(text, {
    columns,
    skipFirstRow: true,
    skipEmptyLines: true,
    trim: true,
    delimiter: ",",
    emptyValue: null,
  }) as unknown as T[];
};

const backupCsv = async (folder: string, filename: string) => {
  const source = `./data/${folder}/${filename}`;
  if (!await fileExists(source)) return;

  const backupDir = `./data/${folder}/.quality-backups`;
  await Deno.mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-");
  await Deno.copyFile(source, `${backupDir}/${stamp}-${filename}`);
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

export const dataQualityFix = {
  run: async (
    folder: string,
    strava: StravaDataService,
    action: string,
    onProgress?: (percentage: number) => Promise<void>,
    throwIfCancelled?: () => Promise<void>,
  ) => {
    console.log(
      colors.blue("::Task::") + `Running Data Quality Fix: ${action}`,
    );

    const activitiesPath = `./data/${folder}/activities.csv`;
    const mediaPath = `./data/${folder}/media.csv`;

    await throwIfCancelled?.();
    if (onProgress) await onProgress(1);

    if (action === "dedupe_activities") {
      const activities = await strava.activities.list();
      const seen = new Set<string>();
      const deduped: IActivity[] = [];

      for (const activity of activities) {
        const id = String(activity.activity_id ?? "").trim();
        if (!id) {
          deduped.push(activity);
          continue;
        }
        if (seen.has(id)) continue;
        seen.add(id);
        deduped.push(activity);
      }

      await throwIfCancelled?.();
      if (onProgress) await onProgress(60);

      const removed = activities.length - deduped.length;
      if (removed <= 0) throw new Error("No duplicates found to remove.");

      await backupCsv(folder, "activities.csv");
      await writeCsv(
        activitiesPath,
        activityColumns,
        deduped as unknown as Record<string, unknown>[],
      );
    } else if (action === "repair_timestamps") {
      const activities = await strava.activities.list();
      let changed = 0;

      const repaired = activities.map((activity) => {
        const next = { ...activity };
        const activityDate = toValidDate(next.activity_date);
        const startTime = toValidDate(next.start_time);
        if (!activityDate && startTime) {
          next.activity_date = startTime;
          changed += 1;
        }
        return next;
      });

      await throwIfCancelled?.();
      if (onProgress) await onProgress(60);

      if (changed <= 0) throw new Error("No timestamp repairs were needed.");

      await backupCsv(folder, "activities.csv");
      await writeCsv(
        activitiesPath,
        activityColumns,
        repaired as unknown as Record<string, unknown>[],
      );
    } else if (action === "remove_malformed_records") {
      const activities = await strava.activities.list();
      const cleaned = activities.filter((activity) => {
        const id = String(activity.activity_id ?? "").trim();
        const activityDate = String(activity.activity_date ?? "").trim();
        const startTime = String(activity.start_time ?? "").trim();
        const hasInvalidActivityDate = activityDate.length > 0 &&
          !toValidDate(activityDate);
        const hasInvalidStartTime = startTime.length > 0 &&
          !toValidDate(startTime);
        return id.length > 0 && !hasInvalidActivityDate && !hasInvalidStartTime;
      });

      await throwIfCancelled?.();
      if (onProgress) await onProgress(60);

      const removed = activities.length - cleaned.length;
      if (removed <= 0) throw new Error("No malformed activity rows found.");

      await backupCsv(folder, "activities.csv");
      await writeCsv(
        activitiesPath,
        activityColumns,
        cleaned as unknown as Record<string, unknown>[],
      );
    } else if (action === "remove_orphan_media") {
      if (!await fileExists(mediaPath)) {
        throw new Error("media.csv does not exist for this dataset.");
      }

      const activities = await strava.activities.list();
      const media = await strava.profile.getMedia();
      const orphanPath = `./data/${folder}/media.orphans.csv`;

      const activityIds = new Set(
        activities.map((a) => String(a.activity_id ?? "").trim()).filter(
          Boolean,
        ),
      );
      const activityKeys = new Set(
        activities.map((a) => normalizeActivityFileKey(a)).filter(Boolean),
      );

      const filtered = media.filter((item) => {
        const filename = String(item.filename ?? "").trim();
        const base = filename.split("/").pop()?.replace(/\.[^.]+$/, "") ??
          filename;
        const idMatch = base.match(/(\d{5,})/);
        const inferredId = idMatch?.[1] ?? "";
        const linkedById = inferredId ? activityIds.has(inferredId) : false;
        const linkedByFilename = activityKeys.has(base) ||
          activityKeys.has(filename);
        return linkedById || linkedByFilename;
      });

      await throwIfCancelled?.();
      if (onProgress) await onProgress(60);

      const removed = media.length - filtered.length;
      if (removed <= 0) throw new Error("No orphan media rows found.");

      await backupCsv(folder, "media.csv");
      await backupCsv(folder, "media.orphans.csv");

      const existingOrphans = await readCsv<IMedia>(orphanPath, mediaColumns);
      const toQuarantine = media.filter((item) => !filtered.includes(item));
      const quarantineMap = new Map<string, IMedia>();
      for (const orphan of [...existingOrphans, ...toQuarantine]) {
        const key = `${String(orphan.filename ?? "").trim()}|${
          String(orphan.caption ?? "").trim()
        }`;
        quarantineMap.set(key, orphan);
      }
      const quarantined = [...quarantineMap.values()];

      await writeCsv(
        mediaPath,
        mediaColumns,
        filtered as unknown as Record<string, unknown>[],
      );
      await writeCsv(
        orphanPath,
        mediaColumns,
        quarantined as unknown as Record<string, unknown>[],
      );
    } else {
      throw new Error(`Unknown data quality fix action: ${action}`);
    }

    await throwIfCancelled?.();
    if (onProgress) await onProgress(90);

    await sdevTasks.enqueue({
      userId: folder,
      type: TaskType.DataQualityScan,
      body: "Scanning dataset quality issues.",
    } as QueueEntry);

    if (onProgress) await onProgress(100);
  },
};
