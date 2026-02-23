import { Head } from "$fresh/runtime.ts";
import { FreshContext, Handlers, PageProps } from "$fresh/server.ts";
import sdevTasks from "../packages/sdev.tasks/index.ts";
import { TaskType } from "../packages/sdev.tasks/interfaces/task-type.ts";
import { type DataQualityFixAction } from "../packages/sdev.tasks/tasks/fix-data-quality.ts";
import TasksTable, { type TaskRow } from "../islands/TasksTable.tsx";

interface Props {
  tasks: TaskRow[];
}

const bodyByType: Record<TaskType, string> = {
  [TaskType.ProcessActivities]: "Extract gzipped activities.",
  [TaskType.GenerateHeatmap]: "Generating heatmap from activities.",
  [TaskType.ProcessAthletes]: "Fetching athlete information.",
  [TaskType.GenerateActivityImages]: "Generating activity route images.",
  [TaskType.GenerateRouteImages]: "Generating route images.",
  [TaskType.DataQualityScan]: "Scanning dataset quality issues.",
  [TaskType.DataQualityFix]: "Running a data quality fix.",
};

const isDataQualityFixAction = (
  value: string,
): value is DataQualityFixAction => {
  return value === "dedupe_activities" ||
    value === "repair_timestamps" ||
    value === "remove_malformed_records" ||
    value === "remove_orphan_media";
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
        const fixActionRaw = form.get("fix_action")?.toString() ?? "";
        const fixAction = isDataQualityFixAction(fixActionRaw)
          ? fixActionRaw
          : "dedupe_activities";

        await sdevTasks.enqueue({
          userId: folder,
          type: taskType as TaskType,
          body: taskType === TaskType.DataQualityFix
            ? `Running data quality fix: ${fixAction}`
            : bodyByType[taskType as TaskType] ??
              "Task requested from Tasks page.",
          ...(taskType === TaskType.DataQualityFix
            ? { payload: { action: fixAction } }
            : {}),
        });
      }
    }

    return Response.redirect(new URL("/tasks", req.url), 303);
  },
};

export default function TasksPage(props: PageProps<Props>) {
  return (
    <>
      <Head>
        <title>Tasks</title>
      </Head>
      <div class="data-health-page">
        <section>
          <h3>Tasks</h3>
          <TasksTable initialTasks={props.data.tasks} />
        </section>
      </div>
    </>
  );
}
