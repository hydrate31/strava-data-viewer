import { parse } from "@std/csv/parse";
import clubs_columns from "./data/clubs-columns.ts";
import application_columns from "./data/application-columns.ts";
import connected_app_columns from "./data/connected-app-columns.ts";
import event_columns from "./data/event-columns.ts";
import profile_columns from "./data/profile-columns.ts";
import media_columns from "./data/media-columns.ts";
import global_challenges_columns from "./data/global-challenges-columns.ts";
import local_challenges_columns from "./data/group-challenges-columns.ts";
import goal_columns from "./data/goal-columns.ts";
import follow_columns from "./data/follow-columns.ts";
import email_preferences_columns from "./data/email-preferences-columns.ts";
import { fileExists } from "./helpers/fileExists.ts";
import { IApplication } from "./interface/application.ts";
import { IConnectedApp } from "./interface/connected_app.ts";
import { IEmailPreference } from "./interface/email_preference.ts";
import { IEvent } from "./interface/event.ts";
import { IProfile } from "./interface/profile.ts";
import { IMedia } from "./interface/media.ts";
import { IGlobalChallenge } from "./interface/global-challenges.ts";
import { IGroupChallenge } from "./interface/group-challenges.ts";
import { IGoal } from "./interface/goal.ts";
import { IFollow } from "./interface/follow.ts";
import { IClub } from "./interface/club.ts";


export default (folder: string) => ({
    get: async (): Promise<IProfile> => {
        const data = await Deno.readTextFile(`./data/${folder}/profile.csv`);
        const profile: IProfile = parse(data, {
            columns: profile_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        })[0] as any;

        return profile;
    },

    getMedia: async(): Promise<IMedia[]> => {
        const data = await Deno.readTextFile(`./data/${folder}/media.csv`);
        const media: IMedia[] = parse(data, {
            columns: media_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;

        return media;
    },

    getGlobalChallenges: async (): Promise<IGlobalChallenge[]> => {
        const data = await Deno.readTextFile(`./data/${folder}/global_challenges.csv`);
        const globalChallenges: IGlobalChallenge[] = parse(data, {
            columns: global_challenges_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;

        return globalChallenges;
    },

    getGroupChallenges: async (): Promise<IGroupChallenge[]> => {
        const data = await Deno.readTextFile(`./data/${folder}/group_challenges.csv`);
        const groupChallenges: IGroupChallenge[] = parse(data, {
            columns: local_challenges_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;

        return groupChallenges;
    },

    getGoals: async (): Promise<IGoal[]> => {
        const data = await Deno.readTextFile(`./data/${folder}/goals.csv`);
        const goals: IGoal[] = parse(data, {
            columns: goal_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;

        return goals;
    },

    getFollowers: async (): Promise<IFollow[]> => {
        const data = await Deno.readTextFile(`./data/${folder}/followers.csv`);
        const followers: IFollow[] = parse(data, {
            columns: follow_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;
        
        return followers;
    },

    getFollowing: async (): Promise<IFollow[]> => {
        const data = await Deno.readTextFile(`./data/${folder}/following.csv`);
        const followers: IFollow[] = parse(data, {
            columns: follow_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;
        
        return followers;
    },

    getClubs: async (): Promise<IClub[]> => {
        const data = await Deno.readTextFile(`./data/${folder}/clubs.csv`);
        const clubs: IClub[] = parse(data, {
            columns: clubs_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;
        
        return clubs;
    },

    getEvents: async (): Promise<IEvent[]> => {
        const path = `./data/${folder}/events.csv`;
        if (!await fileExists(path)) {
            return [];
        }

        const data = await Deno.readTextFile(path);
        const events: IEvent[] = parse(data, {
            columns: event_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;

        return events;
    },

    getApplications: async (): Promise<IApplication[]> => {
        const path = `./data/${folder}/applications.csv`;
        if (!await fileExists(path)) {
            return [];
        }

        const data = await Deno.readTextFile(path);
        const applications: IApplication[] = parse(data, {
            columns: application_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;

        return applications;
    },

    getConnectedApps: async (): Promise<IConnectedApp[]> => {
        const path = `./data/${folder}/connected_apps.csv`;
        if (!await fileExists(path)) {
            return [];
        }

        const data = await Deno.readTextFile(path);
        const connectedApps: IConnectedApp[] = parse(data, {
            columns: connected_app_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;

        return connectedApps;
    },

    getEmailPreferences: async (): Promise<IEmailPreference | null> => {
        const path = `./data/${folder}/email_preferences.csv`;
        if (!await fileExists(path)) {
            return null;
        }

        const data = await Deno.readTextFile(path);
        const preferences = parse(data, {
            columns: email_preferences_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any as IEmailPreference[];

        return preferences[0] ?? null;
    }
})
