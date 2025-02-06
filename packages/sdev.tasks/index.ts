import { run } from "node:test";
import { QueueEntry } from "./interfaces/queue-entry.ts";
import { TaskType } from "./interfaces/task-type.ts";
import { StravaDataService } from "../strava.data.service/index.ts";
import { heatmap } from "./tasks/generate-heatmap.ts";
import { activities } from "./tasks/process-activities.ts";

  
const tasks = await Deno.openKv('./data/tasks');

export default {
    enqueue: async (entry: QueueEntry) => {
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
    }
    tasks.delete([entry.type.toString(), entry.userId]);

    console.log(`Finished ${entry.type} for user: ${entry.userId}`);

});