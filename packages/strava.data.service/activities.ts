import activities from "../strava.export-data-reader/activities.ts";

export default {
    list: async () => {
        return await activities.get();
    },
    get: async (id: string) => {
        const items = await activities.get();
        return {
            activity: items.filter((i) => i.activity_id === id)[0],
            geoJson: await activities.getGeoJson(id),
        }
    },
    listHeatmap: async () => {
        const entries = []
        for await (const dirEntry of Deno.readDir(`./data/export/heatmap/`)) {
            if (dirEntry.isFile) {
                const json = JSON.parse(await Deno.readTextFile(`./data/export/heatmap/${dirEntry.name}`));
                entries.push(json.points);
            }
        }
        return entries
    },
    getGeoJson: async (id: string) => await activities.getGeoJson(id),
    parseGeoJsonToPoints: async (id: string) => await activities.parseGeoJsonToPoints(id),
}