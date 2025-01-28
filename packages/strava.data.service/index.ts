import activities from "./activities.ts";
import gear from "./gear.ts";
import profile from "./profile.ts";

import routes from "../strava.export-data-reader/routes.ts";
import segments from "../strava.export-data-reader/segments.ts";

export default {
    activities,
    gear,
    profile,
    routes: {
        list: async () => {
            return await routes.get();
        },

        getGeoJson: async (file: string) => {
            return await routes.getGeoJson(file);
        },
    },
    segments: {
        list: async () => {
            return await segments.get();
        },
    }
}