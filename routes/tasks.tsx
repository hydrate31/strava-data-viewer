import { Head } from "$fresh/runtime.ts";
import { FreshContext, Handlers, PageProps } from "$fresh/server.ts";
import sdevTasks from "../packages/sdev.tasks/index.ts";
import { TaskType } from "../packages/sdev.tasks/interfaces/task-type.ts";
import TimeAgo from "../components/TimeAgo.tsx";

interface Props {
  tasks: {
    type: TaskType;
    name: string;
    state: {
      status: string;
      percentage: number;
      updatedAt: string;
      startedAt: string | null;
      error: string | null;
    };
  }[];
}

const bodyByType: Record<TaskType, string> = {
  [TaskType.ProcessActivities]: "Extract gzipped activities.",
  [TaskType.GenerateHeatmap]: "Generating heatmap from activities.",
  [TaskType.ProcessAthletes]: "Fetching athlete information.",
  [TaskType.GenerateActivityImages]: "Generating activity route images.",
  [TaskType.GenerateRouteImages]: "Generating route images.",
  [TaskType.DataQualityScan]: "Scanning dataset quality issues.",
};

const runningSince = (startedAt: string | null) => {
  if (!startedAt) return "-";
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return "-";
  const delta = Math.max(0, Date.now() - start);
  const seconds = Math.floor(delta / 1000) % 60;
  const minutes = Math.floor(delta / (1000 * 60)) % 60;
  const hours = Math.floor(delta / (1000 * 60 * 60));
  return `${hours}h ${minutes}m ${seconds}s`;
};

export const handler: Handlers<Props> = {
  async GET(req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const tasks = await sdevTasks.list(folder);
    const url = new URL(req.url);
    if (url.searchParams.get("format") === "json") {
      return Response.json({ tasks });
    }
    return ctx.render({ tasks });
  },
  async POST(req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const form = await req.formData();
    const taskTypeRaw = form.get("task_type")?.toString() ?? "";
    const action = form.get("action")?.toString() ?? "run";
    const taskType = Number(taskTypeRaw);

    if (Number.isInteger(taskType) && taskType in TaskType) {
      if (action === "force_stop") {
        const confirm = form.get("confirm_force_stop")?.toString();
        if (confirm === "yes") {
          await sdevTasks.forceStop({
            userId: folder,
            type: taskType as TaskType,
            body: "Force stop requested from Tasks page.",
          });
        }
      } else {
        await sdevTasks.enqueue({
          userId: folder,
          type: taskType as TaskType,
          body: bodyByType[taskType as TaskType] ??
            "Task requested from Tasks page.",
        });
      }
    }

    return Response.redirect(new URL("/tasks", req.url), 303);
  },
};

export default function TasksPage(props: PageProps<Props>) {
  const clamp = (value: number) =>
    Math.max(0, Math.min(100, Math.floor(value)));

  return (
    <>
      <Head>
        <title>Tasks</title>
      </Head>
      <div class="data-health-page">
        <section>
          <h3>Tasks</h3>
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Updated At</th>
                <th>Running Since</th>
                <th>Error</th>
                <th>Progress</th>
                <th>Run</th>
              </tr>
            </thead>
            <tbody id="task-rows">
              {props.data.tasks.map((task) => (
                <tr>
                  <td>{task.name}</td>
                  <td>{task.state.status}</td>
                  <td>
                    <TimeAgo value={task.state.updatedAt || null} />
                  </td>
                  <td>{runningSince(task.state.startedAt)}</td>
                  <td>{task.state.error || "-"}</td>
                  <td>
                    <div
                      class="task-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={clamp(task.state.percentage)}
                    >
                      <div
                        class="task-progress-fill"
                        style={`width: ${clamp(task.state.percentage)}%;`}
                      />
                      <span class="task-progress-label">
                        {clamp(task.state.percentage)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    {task.state.status === "running" && (
                      <form
                        method="post"
                        {...({
                          onsubmit:
                            "return confirm('Force stop this task? This will request cancellation immediately.');",
                        } as any)}
                      >
                        <input
                          type="hidden"
                          name="task_type"
                          value={task.type.toString()}
                        />
                        <input type="hidden" name="action" value="force_stop" />
                        <input
                          type="hidden"
                          name="confirm_force_stop"
                          value="yes"
                        />
                        <button type="submit" class="danger">
                          Force Stop
                        </button>
                      </form>
                    )}
                    {task.state.status !== "running" && (
                      <form method="post">
                        <input
                          type="hidden"
                          name="task_type"
                          value={task.type.toString()}
                        />
                        <input type="hidden" name="action" value="run" />
                        <button
                          type="submit"
                          disabled={task.state.status === "queued"}
                        >
                          Run
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
(() => {
  const tbody = document.getElementById("task-rows");
  if (!tbody) return;

  const runningSince = (startedAt) => {
    if (!startedAt) return "-";
    const start = new Date(startedAt).getTime();
    if (!Number.isFinite(start)) return "-";
    const delta = Math.max(0, Date.now() - start);
    const seconds = Math.floor(delta / 1000) % 60;
    const minutes = Math.floor(delta / (1000 * 60)) % 60;
    const hours = Math.floor(delta / (1000 * 60 * 60));
    return \`\${hours}h \${minutes}m \${seconds}s\`;
  };

  const clamp = (value) => Math.max(0, Math.min(100, Math.floor(Number(value) || 0)));
  const timeAgo = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    const ms = date.getTime();
    if (!Number.isFinite(ms)) return "-";
    const seconds = Math.round((ms - Date.now()) / 1000);
    const absSeconds = Math.abs(seconds);
    if (absSeconds < 5) return "just now";
    const units = [
      ["year", 60 * 60 * 24 * 365],
      ["month", 60 * 60 * 24 * 30],
      ["week", 60 * 60 * 24 * 7],
      ["day", 60 * 60 * 24],
      ["hour", 60 * 60],
      ["minute", 60],
      ["second", 1]
    ];
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    for (const [unit, unitSeconds] of units) {
      if (absSeconds >= unitSeconds || unit === "second") {
        return rtf.format(Math.round(seconds / unitSeconds), unit);
      }
    }
    return "just now";
  };

  const escapeHtml = (value) => {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  };

  const renderAction = (type, status) => {
    if (status === "running") {
      return \`<form method="post" onsubmit="return confirm('Force stop this task? This will request cancellation immediately.');">
        <input type="hidden" name="task_type" value="\${type}" />
        <input type="hidden" name="action" value="force_stop" />
        <input type="hidden" name="confirm_force_stop" value="yes" />
        <button type="submit" class="danger">Force Stop</button>
      </form>\`;
    }
    const disabled = status === "queued" ? "disabled" : "";
    return \`<form method="post">
      <input type="hidden" name="task_type" value="\${type}" />
      <input type="hidden" name="action" value="run" />
      <button type="submit" \${disabled}>Run</button>
    </form>\`;
  };

  const renderRows = (tasks) => {
    tbody.innerHTML = tasks.map((task) => {
      const percentage = clamp(task.state?.percentage);
      const updatedAt = task.state?.updatedAt || "-";
      const startedAt = task.state?.startedAt || null;
      const error = task.state?.error || "-";
      const status = task.state?.status || "stopped";
      const updatedDate = updatedAt && updatedAt !== "-" ? new Date(updatedAt) : null;
      const updatedMs = updatedDate ? updatedDate.getTime() : NaN;
      const hasUpdatedDate = Number.isFinite(updatedMs);
      const iso = hasUpdatedDate ? updatedDate.toISOString() : "";
      const title = hasUpdatedDate ? updatedDate.toLocaleString() : "";
      const updatedAtHtml = hasUpdatedDate
        ? "<time datetime=\\"" + escapeHtml(iso) + "\\" title=\\"" + escapeHtml(title) + "\\">" + escapeHtml(timeAgo(updatedAt)) + "</time>"
        : "-";
      return \`<tr>
        <td>\${escapeHtml(task.name)}</td>
        <td>\${escapeHtml(status)}</td>
        <td>\${updatedAtHtml}</td>
        <td>\${escapeHtml(runningSince(startedAt))}</td>
        <td>\${escapeHtml(error)}</td>
        <td>
          <div class="task-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="\${percentage}">
            <div class="task-progress-fill" style="width: \${percentage}%;"></div>
            <span class="task-progress-label">\${percentage}%</span>
          </div>
        </td>
        <td>\${renderAction(task.type, status)}</td>
      </tr>\`;
    }).join("");
  };

  const poll = async () => {
    try {
      const response = await fetch("/tasks?format=json", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data.tasks)) return;
      renderRows(data.tasks);
    } catch (_error) {
      // Keep existing rows if polling fails.
    }
  };

  setInterval(poll, 2000);
})();
`,
        }}
      />
    </>
  );
}
