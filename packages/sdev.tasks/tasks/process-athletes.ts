import colors from "npm:colors";

import { StravaDataService } from "../../strava.data.service/index.ts";

import StravaWGetService from "../../strava.wget.service/index.ts";

export const athletes = {
    process: async (folder: string, strava: StravaDataService) => {
        console.log(colors.blue("::Task::") + 'Processing Athletes');
        try { await Deno.mkdir(`./data/${folder}/athletes/`); } catch {}

        const followers = await strava.profile.getFollowers();
        const following = await strava.profile.getFollowing();
        const athletes = [...followers, ...following];

        const athletesDir = `./data/${folder}/athletes`;
        const service = StravaWGetService("");

        
        athletes.forEach(async athlete => {
            const data = await service.athletes.get(athlete.athelete_id);

            // This is here for rate limiting.
            await new Promise((resolve) => setTimeout(() => resolve(null), 500));

            const json = {
                id: athlete.athelete_id,
                ...athlete,
                name: data.name,
                avatarUrl: data.avatarUrl,
            };

            await Deno.writeTextFile(`./data/${folder}/athletes/${athlete.athelete_id}.json`, JSON.stringify(json));
        })
    }
}