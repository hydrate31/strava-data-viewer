import { QueueEntry } from "./interfaces/queue-entry.ts";
import { TaskType } from "./interfaces/task-type.ts";
import { StravaDataService } from "../strava.data.service/index.ts";
import { heatmap } from "./tasks/generate-heatmap.ts";
import { activityImages } from "./tasks/generate-activity-images.ts";
import { routeImages } from "./tasks/generate-route-images.ts";
import { activities } from "./tasks/process-activities.ts";
import { athletes } from "./tasks/process-athletes.ts";

  
const tasks = await Deno.openKv('./data/tasks'); 
const statusKey = (type: TaskType, userId: string) => [`task_status:${type}:${userId}`];
const undeliveredKey = (type: TaskType, userId: string) => ["undelivered", `${type}:${userId}`];
const legacyStatusKey = (type: TaskType, userId: string) => [`${type}:${userId}`];
const legacyUndeliveredKey = (type: TaskType, userId: string) => [type.toString(), userId];

const getTaskStatus = async (type: TaskType, userId: string): Promise<string> => {
    const current = await tasks.get<string>(statusKey(type, userId));
    if (current.value) return current.value;

    // Backward compatibility for older key format.
    const legacy = await tasks.get<string>(legacyStatusKey(type, userId));
    return legacy.value ?? "stopped";
};

export default {
    nullify: async (entry: QueueEntry) => {
        await tasks.set(statusKey(entry.type, entry.userId), 'stopped');
        await tasks.delete(undeliveredKey(entry.type, entry.userId));
        await tasks.delete(legacyStatusKey(entry.type, entry.userId));
        await tasks.delete(legacyUndeliveredKey(entry.type, entry.userId));
    },
    enqueue: async (entry: QueueEntry) => {
        const running = await getTaskStatus(entry.type, entry.userId);

        if (running === "running" || running === "queued") {
            console.log('Task already running.');
            return;
        }
        console.log(`Queued ${entry.type} for user: ${entry.userId}`);
        await tasks.set(statusKey(entry.type, entry.userId), 'queued');
        await tasks.enqueue(entry, { keysIfUndelivered: [undeliveredKey(entry.type, entry.userId)] });
    },
    status: async (type: TaskType, id: string): Promise<string> => {
        return await getTaskStatus(type, id);
    }
}

tasks.listenQueue(async (entry: QueueEntry) => {
    const strava = new StravaDataService(entry.userId)

    const running = await getTaskStatus(entry.type, entry.userId);

    if (running === "running") {
        await tasks.delete(undeliveredKey(entry.type, entry.userId));
        await tasks.delete(legacyUndeliveredKey(entry.type, entry.userId));
        return;
    }

    console.log(`Processing ${entry.type} for user: ${entry.userId}`);
    console.log(`  ${entry.body}`);

    await tasks.set(statusKey(entry.type, entry.userId), 'running');
    try {
        switch (entry.type) {
            case TaskType.ProcessActivities:
                await activities.process(entry.userId, strava);
                break;
            case TaskType.GenerateHeatmap:
                await heatmap.generate(entry.userId, strava);
                break;
            case TaskType.ProcessAthletes:
                await athletes.process(entry.userId, strava);
                break;
            case TaskType.GenerateActivityImages:
                await activityImages.generate(entry.userId, strava);
                break;
            case TaskType.GenerateRouteImages:
                await routeImages.generate(entry.userId, strava);
                break;
            default:
                throw new Error(`Unknown task type: ${entry.type}`);
        }
        await tasks.set(statusKey(entry.type, entry.userId), 'stopped');
    } catch (error) {
        await tasks.set(statusKey(entry.type, entry.userId), 'failed');
        console.error(`Task failed: ${entry.type} for user ${entry.userId}`, error);
    } finally {
        await tasks.delete(undeliveredKey(entry.type, entry.userId));
        await tasks.delete(legacyUndeliveredKey(entry.type, entry.userId));
    }

    console.log(`Finished ${entry.type} for user: ${entry.userId}`);

});
