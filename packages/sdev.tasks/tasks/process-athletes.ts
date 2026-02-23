import colors from "npm:colors";

import { StravaDataService } from "../../strava.data.service/index.ts";

import StravaWGetService from "../../strava.wget.service/index.ts";
import { fileExists } from "../../strava.export-data-reader/helpers/fileExists.ts";

export const athletes = {
    process: async (folder: string, strava: StravaDataService) => {
        console.log(colors.blue("::Task::") + 'Processing Athletes');
        try { await Deno.mkdir(`./data/${folder}/athletes/`); } catch {}

        const followers = await strava.profile.getFollowers();
        const following = await strava.profile.getFollowing();
        const contacts = await strava.profile.getContacts();

        const athleteIds = new Set<string>();
        [...followers, ...following].forEach((athlete) => {
            if (athlete?.athelete_id) {
                athleteIds.add(athlete.athelete_id);
            }
        });
        contacts.forEach((contact) => {
            if (contact?.athlete_id) {
                athleteIds.add(contact.athlete_id);
            }
        });

        const athletesDir = `./data/${folder}/athletes`;
        const service = StravaWGetService("");

        for (const athleteId of athleteIds) {
            const targetFile = `${athletesDir}/${athleteId}.json`;
            if (await fileExists(targetFile)) {
                continue;
            }

            const data = await service.athletes.get(athleteId);

            // This is here for rate limiting.
            await new Promise((resolve) => setTimeout(() => resolve(null), 500));

            const json = {
                id: athleteId,
                name: data.name,
                avatarUrl: data.avatarUrl,
            };

            await Deno.writeTextFile(targetFile, JSON.stringify(json));
        }
    }
}
