import gear from "../strava.export-data-reader/gear.ts";

export default {
    bikes: async () => {
        return await gear.getBikes();
    },
    components: async () => {
        return await gear.getComponents();
    },
    shoes: async () => {
        return await gear.getShoes();
    },
}