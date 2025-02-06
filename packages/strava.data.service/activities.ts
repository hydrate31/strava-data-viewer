import reader from "../strava.export-data-reader/index.ts";

const folder = 'export';
export default {
    list: async () => {
        return await reader(folder).activities.get();
    },
    get: async (id: string) => {
        const items = await reader(folder).activities.get();
        return {
            activity: items.filter((i) => i.activity_id === id)[0],
            geoJson: await reader(folder).activities.getGeoJson(id),
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
    getGeoJson: async (id: string) => await reader(folder).activities.getGeoJson(id),
    parseGeoJsonToPoints: async (id: string) => await reader(folder).activities.parseGeoJsonToPoints(id),
}