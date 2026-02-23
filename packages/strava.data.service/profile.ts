import reader from "../strava.export-data-reader/index.ts";

export default (folder: string) => ({
    get: async () => {
        return await reader(folder).profile.get();
    },
    getMedia: async () => {
        return await reader(folder).profile.getMedia();
    },
    getGlobalChallenges: async () => {
        return await reader(folder).profile.getGlobalChallenges();
    },
    getGroupChallenges: async () => {
        return await reader(folder).profile.getGroupChallenges();
    },
    getGoals: async () => {
        return await reader(folder).profile.getGoals();
    },
    getFollowers: async () => {
        return await reader(folder).profile.getFollowers();
    },
    getFollowing: async () => {
        return await reader(folder).profile.getFollowing();
    },
    getClubs: async () => {
        return await reader(folder).profile.getClubs();
    }
})
