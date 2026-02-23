import activities from "./activities.ts";
import athletes from "./athletes.ts";
import gear from "./gear.ts";
import profile from "./profile.ts";

import reader from "../strava.export-data-reader/index.ts";


export class StravaDataService {
    folder: string = "export";
    reader: ReturnType<typeof reader>

    constructor(folder?: string) {
        if (folder) {
            this.folder = folder;
        }
        this.reader = reader(this.folder);
        this.activities = activities(this.folder);
        this.athletes = athletes(this.folder);
        this.gear = gear(this.folder);
        this.profile = profile(this.folder);
    }

    activities;
    athletes;
    gear;
    profile;
    routes = {
        list: async () => {
            return await this.reader.routes.get();
        },

        getGeoJson: async (file: string) => {
            return await this.reader.routes.getGeoJson(file);
        },
    };
    segments = {
        list: async () => {
            return await this.reader.segments.get();
        },
    };
}
