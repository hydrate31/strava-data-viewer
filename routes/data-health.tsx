import { Head } from "$fresh/runtime.ts";
import { FreshContext, Handlers, PageProps } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../packages/strava.data.service/index.ts";
import { fileExists } from "../packages/strava.export-data-reader/helpers/fileExists.ts";
import TimeAgo from "../components/TimeAgo.tsx";
import activityColumns from "../packages/strava.export-data-reader/data/activities-columns.ts";
import mediaColumns from "../packages/strava.export-data-reader/data/media-columns.ts";
import { IActivity } from "../packages/strava.export-data-reader/interface/activity.ts";
import { IMedia } from "../packages/strava.export-data-reader/interface/media.ts";
import { parse } from "@std/csv/parse";
import sdevTasks, { ITaskState } from "../packages/sdev.tasks/index.ts";
import { TaskType } from "../packages/sdev.tasks/interfaces/task-type.ts";
import {
  detectQualityIssues as detectQualityIssuesLive,
  type IssueSeverity,
  type QualityIssue,
} from "../packages/sdev.tasks/tasks/scan-data-quality.ts";

type DatasetHealth = {
  name: string;
  file: string;
  required: boolean;
  status: "ok" | "missing" | "parse_failed";
  records: string;
  modified: string | null;
};

type DataQualityReport = {
  generatedAt: string;
  issues: QualityIssue[];
};

interface Props {
  health: {
    datasets: DatasetHealth[];
    qualityIssues: QualityIssue[];
    qualityGeneratedAt: string | null;
    qualityTask: ITaskState;
  };
  message: string | null;
}

const formatDate = (date: Date | null | undefined) => {
  return date ? date.toISOString() : null;
};

const recordCount = (data: unknown): string => {
  if (Array.isArray(data)) return String(data.length);
  if (data === null || data === undefined) return "0";
  if (typeof data === "object") return "1";
  return "-";
};

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

const readCsv = async <T,>(
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

const defaultQualityIssues: QualityIssue[] = [
  {
    key: "duplicate_activities",
    label: "Duplicate activities",
    severity: "critical",
    description: "Multiple rows sharing the same activity_id.",
    count: 0,
    samples: [],
    fixAction: null,
  },
  {
    key: "missing_timestamps",
    label: "Missing timestamps",
    severity: "warning",
    description:
      "Rows missing activity_date/start_time or containing invalid dates.",
    count: 0,
    samples: [],
    fixAction: null,
  },
  {
    key: "missing_coordinates",
    label: "Missing coordinates",
    severity: "warning",
    description: "Missing underlying activity route file (.gpx/.fit/.gz).",
    count: 0,
    samples: [],
    fixAction: null,
  },
  {
    key: "malformed_records",
    label: "Malformed activity records",
    severity: "critical",
    description: "Rows missing required identifiers or with invalid dates.",
    count: 0,
    samples: [],
    fixAction: null,
  },
  {
    key: "orphan_media",
    label: "Orphan media",
    severity: "info",
    description: "Media entries not linked to known activity id/filename.",
    count: 0,
    samples: [],
    fixAction: null,
  },
];

const readQualityReport = async (
  folder: string,
): Promise<DataQualityReport | null> => {
  const path = `./data/${folder}/data-quality-report.json`;
  if (!await fileExists(path)) return null;

  try {
    const text = await Deno.readTextFile(path);
    return JSON.parse(text) as DataQualityReport;
  } catch {
    return null;
  }
};

const runFix = async (
  folder: string,
  action: string,
  strava: StravaDataService,
): Promise<string> => {
  const activitiesPath = `./data/${folder}/activities.csv`;
  const mediaPath = `./data/${folder}/media.csv`;

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

    const removed = activities.length - deduped.length;
    if (removed <= 0) return "No duplicates found to remove.";

    await backupCsv(folder, "activities.csv");
    await writeCsv(
      activitiesPath,
      activityColumns,
      deduped as unknown as Record<string, unknown>[],
    );
    return `Removed ${removed} duplicate activity row${
      removed === 1 ? "" : "s"
    }.`;
  }

  if (action === "repair_timestamps") {
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

    if (changed === 0) return "No timestamp repairs were needed.";

    await backupCsv(folder, "activities.csv");
    await writeCsv(
      activitiesPath,
      activityColumns,
      repaired as unknown as Record<string, unknown>[],
    );
    return `Repaired timestamps for ${changed} activity row${
      changed === 1 ? "" : "s"
    }.`;
  }

  if (action === "remove_malformed_records") {
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
    const removed = activities.length - cleaned.length;

    if (removed <= 0) return "No malformed activity rows found.";

    await backupCsv(folder, "activities.csv");
    await writeCsv(
      activitiesPath,
      activityColumns,
      cleaned as unknown as Record<string, unknown>[],
    );
    return `Removed ${removed} malformed activity row${
      removed === 1 ? "" : "s"
    }.`;
  }

  if (action === "remove_orphan_media") {
    if (!await fileExists(mediaPath)) {
      return "media.csv does not exist for this dataset.";
    }

    const activities = await strava.activities.list();
    const media = await strava.profile.getMedia();
    const orphanPath = `./data/${folder}/media.orphans.csv`;

    const activityIds = new Set(
      activities.map((a) => String(a.activity_id ?? "").trim()).filter(Boolean),
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

    const removed = media.length - filtered.length;
    if (removed <= 0) return "No orphan media rows found.";

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
    return `Quarantined ${removed} orphan media row${
      removed === 1 ? "" : "s"
    } to media.orphans.csv.`;
  }

  return "Unknown fix action.";
};

const buildDatasets = async (
  folder: string,
  strava: StravaDataService,
): Promise<DatasetHealth[]> => {
  const datasetChecks = [
    {
      name: "Profile",
      file: "profile.csv",
      required: true,
      load: () => strava.profile.get(),
    },
    {
      name: "Media",
      file: "media.csv",
      required: false,
      load: () => strava.profile.getMedia(),
    },
    {
      name: "Activities",
      file: "activities.csv",
      required: true,
      load: () => strava.activities.list(),
    },
    {
      name: "Routes",
      file: "routes.csv",
      required: false,
      load: () => strava.routes.list(),
    },
    {
      name: "Followers",
      file: "followers.csv",
      required: false,
      load: () => strava.profile.getFollowers(),
    },
    {
      name: "Following",
      file: "following.csv",
      required: false,
      load: () => strava.profile.getFollowing(),
    },
    {
      name: "Goals",
      file: "goals.csv",
      required: false,
      load: () => strava.profile.getGoals(),
    },
    {
      name: "Global Challenges",
      file: "global_challenges.csv",
      required: false,
      load: () => strava.profile.getGlobalChallenges(),
    },
    {
      name: "Group Challenges",
      file: "group_challenges.csv",
      required: false,
      load: () => strava.profile.getGroupChallenges(),
    },
    {
      name: "Clubs",
      file: "clubs.csv",
      required: false,
      load: () => strava.profile.getClubs(),
    },
    {
      name: "Events",
      file: "events.csv",
      required: false,
      load: () => strava.profile.getEvents(),
    },
    {
      name: "Comments",
      file: "comments.csv",
      required: false,
      load: () => strava.profile.getComments(),
    },
    {
      name: "Contacts",
      file: "contacts.csv",
      required: false,
      load: () => strava.profile.getContacts(),
    },
    {
      name: "Blocks",
      file: "blocks.csv",
      required: false,
      load: () => strava.profile.getBlocks(),
    },
    {
      name: "Connected Apps",
      file: "connected_apps.csv",
      required: false,
      load: () => strava.profile.getConnectedApps(),
    },
    {
      name: "Applications",
      file: "applications.csv",
      required: false,
      load: () => strava.profile.getApplications(),
    },
    {
      name: "Email Preferences",
      file: "email_preferences.csv",
      required: false,
      load: () => strava.profile.getEmailPreferences(),
    },
    {
      name: "Bikes",
      file: "bikes.csv",
      required: false,
      load: () => strava.gear.bikes(),
    },
    {
      name: "Shoes",
      file: "shoes.csv",
      required: false,
      load: () => strava.gear.shoes(),
    },
    {
      name: "Components",
      file: "components.csv",
      required: false,
      load: () => strava.gear.components(),
    },
    {
      name: "Segments",
      file: "segments.csv",
      required: false,
      load: () => strava.segments.list(),
    },
  ];

  const datasets: DatasetHealth[] = [];
  for (const check of datasetChecks) {
    const fullPath = `./data/${folder}/${check.file}`;
    const exists = await fileExists(fullPath);
    const stat = exists ? await Deno.stat(fullPath) : null;

    if (!exists) {
      datasets.push({
        name: check.name,
        file: check.file,
        required: check.required,
        status: "missing",
        records: "-",
        modified: null,
      });
      continue;
    }

    try {
      const result = await check.load();
      datasets.push({
        name: check.name,
        file: check.file,
        required: check.required,
        status: "ok",
        records: recordCount(result),
        modified: formatDate(stat?.mtime),
      });
    } catch {
      datasets.push({
        name: check.name,
        file: check.file,
        required: check.required,
        status: "parse_failed",
        records: "-",
        modified: formatDate(stat?.mtime),
      });
    }
  }

  return datasets;
};

const loadPageData = async (
  folder: string,
  message: string | null,
): Promise<Props> => {
  const strava = new StravaDataService(folder);
  const [datasets, qualityTask, qualityReport] = await Promise.all([
    buildDatasets(folder, strava),
    sdevTasks.details(TaskType.DataQualityScan, folder),
    readQualityReport(folder),
  ]);

  let qualityIssues = qualityReport?.issues ?? null;
  if (!qualityIssues) {
    try {
      qualityIssues = await detectQualityIssuesLive(folder, strava);
    } catch {
      qualityIssues = defaultQualityIssues;
    }
  }

  return {
    message,
    health: {
      datasets,
      qualityIssues,
      qualityGeneratedAt: qualityReport?.generatedAt ?? null,
      qualityTask,
    },
  };
};

export const handler: Handlers<Props> = {
  async GET(req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const url = new URL(req.url);
    const message = url.searchParams.get("message");
    return ctx.render(await loadPageData(folder, message));
  },

  async POST(req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const form = await req.formData();
    const action = form.get("action")?.toString() ?? "";
    const strava = new StravaDataService(folder);

    if (action === "run_quality_scan") {
      await sdevTasks.enqueue({
        userId: folder,
        type: TaskType.DataQualityScan,
        body: "Scanning dataset quality issues.",
      });

      return Response.redirect(
        new URL(
          `/data-health?message=${
            encodeURIComponent("Data quality scan queued.")
          }`,
          req.url,
        ),
        303,
      );
    }

    let message = "No action performed.";
    try {
      message = await runFix(folder, action, strava);
      if (action !== "") {
        await sdevTasks.enqueue({
          userId: folder,
          type: TaskType.DataQualityScan,
          body: "Scanning dataset quality issues.",
        });
      }
    } catch (error) {
      message = `Fix failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }

    return Response.redirect(
      new URL(`/data-health?message=${encodeURIComponent(message)}`, req.url),
      303,
    );
  },
};

export const DataHealth = (props: PageProps<Props>) => {
  return (
    <>
      <Head>
        <title>Data Health</title>
      </Head>
      <div class="data-health-page">
        <section>
          <h3>Data Quality Center</h3>
          <p>
            Scan task status:{" "}
            <strong>{props.data.health.qualityTask.status}</strong>{" "}
            ({props.data.health.qualityTask.percentage}%)
          </p>
          <p>
            Last scan: {props.data.health.qualityGeneratedAt
              ? <TimeAgo value={props.data.health.qualityGeneratedAt} />
              : "Not scanned yet (showing live check)"}
          </p>
          <form method="post">
            <input type="hidden" name="action" value="run_quality_scan" />
            <button
              type="submit"
              disabled={props.data.health.qualityTask.status === "running" ||
                props.data.health.qualityTask.status === "queued"}
            >
              Run Quality Scan
            </button>
          </form>
          <p>
            Detects duplicate and malformed records, missing route data, and
            orphan media. One-click fixes create a backup in{" "}
            <code>.quality-backups/</code>.
          </p>
          {props.data.message && (
            <p>
              <strong>{props.data.message}</strong>
            </p>
          )}
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Severity</th>
                <th>Count</th>
                <th>Details</th>
                <th>Fix</th>
              </tr>
            </thead>
            <tbody>
              {props.data.health.qualityIssues.map((issue) => (
                <tr>
                  <td>{issue.label}</td>
                  <td>
                    <strong>{issue.severity}</strong>
                  </td>
                  <td>{issue.count}</td>
                  <td>
                    <div>{issue.description}</div>
                    {issue.samples.length > 0 && (
                      <small>
                        Sample: <code>{issue.samples.join(", ")}</code>
                      </small>
                    )}
                  </td>
                  <td>
                    {issue.fixAction && issue.count > 0
                      ? (
                        <form method="post">
                          <input
                            type="hidden"
                            name="action"
                            value={issue.fixAction}
                          />
                          <button type="submit">Run Fix</button>
                        </form>
                      )
                      : <span>-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3>Data Health</h3>
          <h4>Datasets</h4>
          <table>
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Status</th>
                <th>Required</th>
                <th>Records</th>
                <th>File</th>
                <th>Modified</th>
              </tr>
            </thead>
            <tbody>
              {props.data.health.datasets.map((dataset) => (
                <tr>
                  <td>{dataset.name}</td>
                  <td>{dataset.status}</td>
                  <td>{dataset.required ? "Yes" : "No"}</td>
                  <td>{dataset.records}</td>
                  <td>
                    <code>{dataset.file}</code>
                  </td>
                  <td>
                    <TimeAgo value={dataset.modified} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
};

export default DataHealth;
