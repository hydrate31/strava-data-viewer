import { QueueEntry } from "./interfaces/queue-entry.ts";
import { TaskType } from "./interfaces/task-type.ts";
import { StravaDataService } from "../strava.data.service/index.ts";
import { heatmap } from "./tasks/generate-heatmap.ts";
import { activityImages } from "./tasks/generate-activity-images.ts";
import { routeImages } from "./tasks/generate-route-images.ts";
import { activities } from "./tasks/process-activities.ts";
import { athletes } from "./tasks/process-athletes.ts";
import { dataQuality } from "./tasks/scan-data-quality.ts";

const tasks = await Deno.openKv("./data/tasks");
const statusKey = (
  type: TaskType,
  userId: string,
) => [`task_status:${type}:${userId}`];
const cancelKey = (
  type: TaskType,
  userId: string,
) => [`task_cancel:${type}:${userId}`];
const activeKey = (
  type: TaskType,
  userId: string,
) => [`task_active:${type}:${userId}`];
const undeliveredKey = (
  type: TaskType,
  userId: string,
) => ["undelivered", `${type}:${userId}`];
const legacyStatusKey = (
  type: TaskType,
  userId: string,
) => [`${type}:${userId}`];
const legacyUndeliveredKey = (
  type: TaskType,
  userId: string,
) => [type.toString(), userId];

export interface ITaskState {
  status: "queued" | "running" | "stopped" | "failed";
  percentage: number;
  updatedAt: string;
  startedAt: string | null;
  error: string | null;
}

const nowIso = () => new Date().toISOString();
const clampPercentage = (value: number) =>
  Math.max(0, Math.min(100, Math.floor(value)));
const isTaskCancelled = async (type: TaskType, userId: string) => {
  const state = await tasks.get<boolean>(cancelKey(type, userId));
  return state.value === true;
};
const isTaskActive = async (type: TaskType, userId: string) => {
  const state = await tasks.get<boolean>(activeKey(type, userId));
  return state.value === true;
};

class TaskCancelledError extends Error {
  constructor() {
    super("Task cancelled");
    this.name = "TaskCancelledError";
  }
}

const buildState = (
  status: ITaskState["status"],
  partial: Partial<ITaskState> = {},
): ITaskState => ({
  status,
  percentage: partial.percentage ?? (status === "stopped" ? 100 : 0),
  updatedAt: partial.updatedAt ?? nowIso(),
  startedAt: partial.startedAt ?? (status === "running" ? nowIso() : null),
  error: partial.error ?? null,
});

const getTaskState = async (
  type: TaskType,
  userId: string,
): Promise<ITaskState> => {
  const current = await tasks.get<ITaskState | string>(statusKey(type, userId));
  if (current.value) {
    if (typeof current.value === "string") {
      return buildState(
        current.value as ITaskState["status"],
        { startedAt: null },
      );
    }

    return {
      ...current.value,
      percentage: Number.isFinite(current.value.percentage)
        ? current.value.percentage
        : 0,
      updatedAt: current.value.updatedAt ?? nowIso(),
      startedAt: current.value.startedAt ?? null,
      error: current.value.error ?? null,
    };
  }

  // Backward compatibility for older key format.
  const legacy = await tasks.get<string>(legacyStatusKey(type, userId));
  if (legacy.value) {
    return buildState(legacy.value as ITaskState["status"], {
      startedAt: null,
    });
  }

  return buildState("stopped");
};

const sdevTasks = {
  forceStop: async (entry: QueueEntry) => {
    await tasks.set(cancelKey(entry.type, entry.userId), true);
    await tasks.set(
      statusKey(entry.type, entry.userId),
      buildState("stopped", { percentage: 0, startedAt: null }),
    );
    await tasks.delete(undeliveredKey(entry.type, entry.userId));
    await tasks.delete(legacyUndeliveredKey(entry.type, entry.userId));
  },
  enqueue: async (entry: QueueEntry) => {
    const current = await getTaskState(entry.type, entry.userId);
    const running = current.status;
    const active = await isTaskActive(entry.type, entry.userId);

    if (running === "running" || running === "queued" || active) {
      console.log("Task already running.");
      return;
    }
    console.log(`Queued ${entry.type} for user: ${entry.userId}`);
    await tasks.delete(cancelKey(entry.type, entry.userId));
    await tasks.set(
      statusKey(entry.type, entry.userId),
      buildState("queued", { percentage: 0, startedAt: null }),
    );
    await tasks.enqueue(entry, {
      keysIfUndelivered: [undeliveredKey(entry.type, entry.userId)],
    });
  },
  status: async (type: TaskType, id: string): Promise<string> => {
    return (await getTaskState(type, id)).status;
  },
  details: async (type: TaskType, id: string): Promise<ITaskState> => {
    return await getTaskState(type, id);
  },
  list: async (
    id: string,
  ): Promise<{ type: TaskType; name: string; state: ITaskState }[]> => {
    const taskTypes = Object.values(TaskType).filter((entry) =>
      typeof entry === "number"
    ) as TaskType[];
    const rows = [];
    for (const type of taskTypes) {
      rows.push({
        type,
        name: TaskType[type],
        state: await getTaskState(type, id),
      });
    }
    return rows;
  },
  progress: async (type: TaskType, id: string, percentage: number) => {
    const current = await getTaskState(type, id);
    if (current.status !== "running") return;

    await tasks.set(
      statusKey(type, id),
      buildState("running", {
        percentage: clampPercentage(percentage),
        startedAt: current.startedAt ?? nowIso(),
        error: null,
      }),
    );
  },
  shouldCancel: async (type: TaskType, id: string): Promise<boolean> => {
    return await isTaskCancelled(type, id);
  },
};

export default sdevTasks;

tasks.listenQueue(async (entry: QueueEntry) => {
  const strava = new StravaDataService(entry.userId);

  const current = await getTaskState(entry.type, entry.userId);
  const running = current.status;

  if (running === "running") {
    await tasks.delete(undeliveredKey(entry.type, entry.userId));
    await tasks.delete(legacyUndeliveredKey(entry.type, entry.userId));
    return;
  }

  console.log(`Processing ${entry.type} for user: ${entry.userId}`);
  console.log(`  ${entry.body}`);

  if (await isTaskCancelled(entry.type, entry.userId)) {
    await tasks.set(
      statusKey(entry.type, entry.userId),
      buildState("stopped", { percentage: 0, startedAt: null, error: null }),
    );
    await tasks.delete(cancelKey(entry.type, entry.userId));
    await tasks.delete(undeliveredKey(entry.type, entry.userId));
    await tasks.delete(legacyUndeliveredKey(entry.type, entry.userId));
    return;
  }

  const runningStartedAt = nowIso();
  await tasks.set(activeKey(entry.type, entry.userId), true);
  await tasks.set(
    statusKey(entry.type, entry.userId),
    buildState("running", {
      percentage: 0,
      startedAt: runningStartedAt,
      error: null,
    }),
  );
  let lastProgress = 0;
  const reportProgress = async (percentage: number) => {
    if (await sdevTasks.shouldCancel(entry.type, entry.userId)) {
      throw new TaskCancelledError();
    }
    lastProgress = clampPercentage(percentage);
    await sdevTasks.progress(entry.type, entry.userId, lastProgress);
  };
  const throwIfCancelled = async () => {
    if (await sdevTasks.shouldCancel(entry.type, entry.userId)) {
      throw new TaskCancelledError();
    }
  };
  try {
    switch (entry.type) {
      case TaskType.ProcessActivities:
        await activities.process(entry.userId, strava, throwIfCancelled);
        break;
      case TaskType.GenerateHeatmap:
        await heatmap.generate(
          entry.userId,
          strava,
          reportProgress,
          throwIfCancelled,
        );
        break;
      case TaskType.ProcessAthletes:
        await athletes.process(entry.userId, strava, throwIfCancelled);
        break;
      case TaskType.GenerateActivityImages:
        await activityImages.generate(
          entry.userId,
          strava,
          reportProgress,
          throwIfCancelled,
        );
        break;
      case TaskType.GenerateRouteImages:
        await routeImages.generate(
          entry.userId,
          strava,
          reportProgress,
          throwIfCancelled,
        );
        break;
      case TaskType.DataQualityScan:
        await dataQuality.scan(
          entry.userId,
          strava,
          reportProgress,
          throwIfCancelled,
        );
        break;
      default:
        throw new Error(`Unknown task type: ${entry.type}`);
    }
    await tasks.set(
      statusKey(entry.type, entry.userId),
      buildState("stopped", { percentage: 100, startedAt: null, error: null }),
    );
  } catch (error) {
    if (
      error instanceof TaskCancelledError ||
      (error instanceof Error && error.name === "TaskCancelledError")
    ) {
      await tasks.set(
        statusKey(entry.type, entry.userId),
        buildState("stopped", {
          percentage: lastProgress,
          startedAt: null,
          error: null,
        }),
      );
      return;
    }
    await tasks.set(
      statusKey(entry.type, entry.userId),
      buildState("failed", {
        percentage: lastProgress,
        startedAt: null,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    console.error(`Task failed: ${entry.type} for user ${entry.userId}`, error);
  } finally {
    await tasks.delete(activeKey(entry.type, entry.userId));
    await tasks.delete(cancelKey(entry.type, entry.userId));
    await tasks.delete(undeliveredKey(entry.type, entry.userId));
    await tasks.delete(legacyUndeliveredKey(entry.type, entry.userId));
  }

  console.log(`Finished ${entry.type} for user: ${entry.userId}`);
});
