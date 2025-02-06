import { run } from "node:test";
import { QueueEntry } from "./interfaces/queue-entry.ts";
import { TaskType } from "./interfaces/task-type.ts";

  
const tasks = await Deno.openKv('./data/tasks');

export default {
    queued: async (entry: QueueEntry) => {
        tasks.set([entry.type], 'queued');
        await tasks.enqueue(entry);
    }
}

tasks.listenQueue((entry: QueueEntry) => {
    console.log(`Processing ${entry.type} for user: ${entry.userId}`);
    console.log(`  ${entry.body}`);
    switch (entry.type) {
        case TaskType.ProcessActivities:
            tasks.set([TaskType.ProcessActivities], 'running');

            tasks.set([TaskType.ProcessActivities], 'stopped');
            break;
        case TaskType.GenerateHeatmap:
            tasks.set([TaskType.GenerateHeatmap], 'running');

            tasks.set([TaskType.GenerateHeatmap], 'stopped');
            break;
    }

});