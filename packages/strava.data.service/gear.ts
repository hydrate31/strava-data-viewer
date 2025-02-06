import reader from "../strava.export-data-reader/index.ts";

const folder = 'export';

export default {
    bikes: async () => {
        return await reader(folder).gear.getBikes();
    },
    components: async () => {
        return await reader(folder).gear.getComponents();
    },
    shoes: async () => {
        return await reader(folder).gear.getShoes();
    },
}