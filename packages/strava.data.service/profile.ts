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
    },
    getEvents: async () => {
        return await reader(folder).profile.getEvents();
    },
    getApplications: async () => {
        return await reader(folder).profile.getApplications();
    },
    getConnectedApps: async () => {
        return await reader(folder).profile.getConnectedApps();
    },
    getEmailPreferences: async () => {
        return await reader(folder).profile.getEmailPreferences();
    },
    getContacts: async () => {
        return await reader(folder).profile.getContacts();
    },
    getComments: async () => {
        return await reader(folder).profile.getComments();
    },
    getBlocks: async () => {
        return await reader(folder).profile.getBlocks();
    }
})
