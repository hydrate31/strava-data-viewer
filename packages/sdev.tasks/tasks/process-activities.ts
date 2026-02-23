import colors from "npm:colors";

import { StravaDataService } from "../../strava.data.service/index.ts";

import compressing from "npm:compressing";
import sdevTasks from "../index.ts";
import { TaskType } from "../interfaces/task-type.ts";
import { QueueEntry } from "../interfaces/queue-entry.ts";

export const activities = {
    process: async (
        folder: string,
        strava: StravaDataService,
        throwIfCancelled?: () => Promise<void>,
    ) => {
        console.log(colors.blue("::Task::") + 'Processing Activities');
        const activitiesDir = `./data/${folder}/activities`;
        for await (const dirEntry of Deno.readDir(activitiesDir)) {
            await throwIfCancelled?.();
            if (dirEntry.name.endsWith(".gz")) {
                await compressing.gzip.uncompress(`${activitiesDir}/${dirEntry.name}`, `${activitiesDir}/${dirEntry.name.replace('.gz', '')}`)
                await Deno.remove(`${activitiesDir}/${dirEntry.name}`)
                console.log(colors.green("::Activity::") + ` ${dirEntry.name}`)
            }
        }

        await throwIfCancelled?.();
        await sdevTasks.enqueue({
            userId: folder,
            type: TaskType.GenerateHeatmap,
            body: "Generating heatmap from activities."
        } as QueueEntry);

        await throwIfCancelled?.();
        await sdevTasks.enqueue({
            userId: folder,
            type: TaskType.GenerateActivityImages,
            body: "Generating activity route images."
        } as QueueEntry);
    }
}
