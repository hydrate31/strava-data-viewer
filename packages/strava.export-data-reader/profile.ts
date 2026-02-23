import { parse } from "@std/csv/parse";
import clubs_columns from "./data/clubs-columns.ts";
import profile_columns from "./data/profile-columns.ts";
import media_columns from "./data/media-columns.ts";
import global_challenges_columns from "./data/global-challenges-columns.ts";
import local_challenges_columns from "./data/group-challenges-columns.ts";
import goal_columns from "./data/goal-columns.ts";
import follow_columns from "./data/follow-columns.ts";
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
    }
})
