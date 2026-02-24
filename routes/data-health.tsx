import { Head } from "$fresh/runtime.ts";
import { FreshContext, Handlers, PageProps } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../packages/strava.data.service/index.ts";
import { fileExists } from "../packages/strava.export-data-reader/helpers/fileExists.ts";
import TimeAgo from "../components/TimeAgo.tsx";
import sdevTasks, { ITaskState } from "../packages/sdev.tasks/index.ts";
import { TaskType } from "../packages/sdev.tasks/interfaces/task-type.ts";
import {
  detectQualityIssues as detectQualityIssuesLive,
  type IssueSeverity,
  type QualityIssue,
} from "../packages/sdev.tasks/tasks/scan-data-quality.ts";
import { type DataQualityFixAction } from "../packages/sdev.tasks/tasks/fix-data-quality.ts";
import StatePanel from "../components/StatePanel.tsx";

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

const isDataQualityFixAction = (
  action: string,
): action is DataQualityFixAction => {
  return action === "dedupe_activities" ||
    action === "repair_timestamps" ||
    action === "remove_orphan_media" ||
    action === "remove_malformed_records";
};

const statusClassName = (value: string) =>
  `status-pill is-${value.toLowerCase().replaceAll(" ", "_")}`;

const severityClassName = (value: IssueSeverity) =>
  `status-pill is-${value.toLowerCase().replaceAll(" ", "_")}`;

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

    if (isDataQualityFixAction(action)) {
      await sdevTasks.enqueue({
        userId: folder,
        type: TaskType.DataQualityFix,
        body: `Running data quality fix: ${action}`,
        payload: { action },
      });

      return Response.redirect(
        new URL(
          `/data-health?message=${
            encodeURIComponent(`Queued data quality fix: ${action}`)
          }`,
          req.url,
        ),
        303,
      );
    }

    return Response.redirect(
      new URL(
        `/data-health?message=${encodeURIComponent("Unknown action.")}`,
        req.url,
      ),
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
            <span class={statusClassName(props.data.health.qualityTask.status)}>
              {props.data.health.qualityTask.status}
            </span>{" "}
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
              class="primary"
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
            <StatePanel
              kind="info"
              title={props.data.message}
              actions={[
                { href: "/data-health", label: "Refresh", primary: true },
                { href: "/tasks", label: "Open Tasks" },
              ]}
            />
          )}
          <div class="table-scroll">
            <table class="responsive-table">
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
                    <td data-label="Issue">{issue.label}</td>
                    <td data-label="Severity">
                      <span class={severityClassName(issue.severity)}>
                        {issue.severity}
                      </span>
                    </td>
                    <td data-label="Count">{issue.count}</td>
                    <td data-label="Details">
                      <div>{issue.description}</div>
                      {issue.samples.length > 0 && (
                        <small>
                          Sample: <code>{issue.samples.join(", ")}</code>
                        </small>
                      )}
                    </td>
                    <td data-label="Fix">
                      {issue.fixAction && issue.count > 0
                        ? (
                          <form method="post">
                            <input
                              type="hidden"
                              name="action"
                              value={issue.fixAction}
                            />
                            <button type="submit" class="primary">
                              Run Fix
                            </button>
                          </form>
                        )
                        : <span>-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3>Data Health</h3>
          <h4>Datasets</h4>
          <div class="table-scroll">
            <table class="responsive-table">
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
                    <td data-label="Dataset">{dataset.name}</td>
                    <td data-label="Status">
                      <span class={statusClassName(dataset.status)}>
                        {dataset.status}
                      </span>
                    </td>
                    <td data-label="Required">
                      {dataset.required ? "Yes" : "No"}
                    </td>
                    <td data-label="Records">{dataset.records}</td>
                    <td data-label="File">
                      <code>{dataset.file}</code>
                    </td>
                    <td data-label="Modified">
                      <TimeAgo value={dataset.modified} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
};

export default DataHealth;
