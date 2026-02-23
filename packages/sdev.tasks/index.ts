import { run } from "node:test";
import { QueueEntry } from "./interfaces/queue-entry.ts";
import { TaskType } from "./interfaces/task-type.ts";
import { StravaDataService } from "../strava.data.service/index.ts";
import { heatmap } from "./tasks/generate-heatmap.ts";
import { activityImages } from "./tasks/generate-activity-images.ts";
import { activities } from "./tasks/process-activities.ts";
import { athletes } from "./tasks/process-athletes.ts";

  
const tasks = await Deno.openKv('./data/tasks'); 

export default {
    nullify: async (entry: QueueEntry) => {
        await tasks.set([entry.type], 'stopped');
        await tasks.delete([entry.type.toString(), entry.userId]);
    },
    enqueue: async (entry: QueueEntry) => {
        const result = await tasks.get<string>([`${entry.type}:${entry.userId}`]);
        const running = result?.value ?? "stopped";

        if (running !== "stopped") {
            console.log('Task already running.');
            return;
        }
        console.log(`Queued ${entry.type} for user: ${entry.userId}`);
        tasks.set([entry.type], 'queued');
        await tasks.enqueue(entry, { keysIfUndelivered: [[entry.type.toString(), entry.userId]] });
    },
    status: async (type: TaskType, id: string): Promise<string> => {
        const result = await tasks.get<string>([`${type}:${id}`]);
        return result?.value ?? "stopped";
    }
}

tasks.listenQueue(async (entry: QueueEntry) => {
    const strava = new StravaDataService(entry.userId)

    const result = await tasks.get<string>([`${entry.type}:${entry.userId}`]);
    const running = result?.value ?? "stopped";

    if (running !== "stopped") {
        tasks.delete([entry.type.toString(), entry.userId]);
        return;
    }

    console.log(`Processing ${entry.type} for user: ${entry.userId}`);
    console.log(`  ${entry.body}`);

    switch (entry.type) {
        case TaskType.ProcessActivities:
            tasks.set([`${entry.type}:${entry.userId}`], 'running');
            await activities.process(entry.userId, strava);
            tasks.set([`${entry.type}:${entry.userId}`], 'stopped');
            break;
        case TaskType.GenerateHeatmap:
            tasks.set([`${entry.type}:${entry.userId}`], 'running');
            await heatmap.generate(entry.userId, strava);
            tasks.set([`${entry.type}:${entry.userId}`], 'stopped');
            break;
        case TaskType.ProcessAthletes:
            tasks.set([`${entry.type}:${entry.userId}`], 'running');
            await athletes.process(entry.userId, strava);
            tasks.set([`${entry.type}:${entry.userId}`], 'stopped');
            break;
        case TaskType.GenerateActivityImages:
            tasks.set([`${entry.type}:${entry.userId}`], 'running');
            await activityImages.generate(entry.userId, strava);
            tasks.set([`${entry.type}:${entry.userId}`], 'stopped');
            break;
    }
    tasks.delete([entry.type.toString(), entry.userId]);

    console.log(`Finished ${entry.type} for user: ${entry.userId}`);

});
