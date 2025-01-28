import profile from "../strava.export-data-reader/profile.ts";

export default {
    get: async () => {
        return await profile.get();
    },
    getMedia: async () => {
        return await profile.getMedia();
    },
    getGlobalChallenges: async () => {
        return await profile.getGlobalChallenges();
    },
    getGroupChallenges: async () => {
        return await profile.getGroupChallenges();
    },
    getGoals: async () => {
        return await profile.getGoals();
    },
    getFollowers: async () => {
        return await profile.getFollowers();
    },
    getFollowing: async () => {
        return await profile.getFollowing();
    },
    getClubs: async () => {
        return await profile.getClubs();
    }
}