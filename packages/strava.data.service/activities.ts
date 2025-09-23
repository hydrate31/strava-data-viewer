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
        for await (const dirEntry of Deno.readDir(`./data/${folder}/heatmap/`)) {
            if (dirEntry.isFile) {
                const json = JSON.parse(await Deno.readTextFile(`./data/${folder}/heatmap/${dirEntry.name}`));
                entries.push(json.points);
            }
        }
        return entries
    },
    cacheHeatmap: async (heatmaps: any) => {
         const heatmapPoints = {
            type: "FeatureCollection",
            features: heatmaps.map((entry: any) => ({
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: entry
                },
                properties: {}
            }))
        };

        await Deno.writeTextFile(`./data/${folder}/heatmap/heatmap.json`, JSON.stringify(heatmapPoints))
    },
    fetchHeatmapCache: async () => {
        try {
            const text = await Deno.readTextFile(`./data/${folder}/heatmap/heatmap.json`);
            const json = JSON.parse(text);

            return json;
        }
        catch {
            return {}
        }
        
    },
    getGeoJsonFromGPX: async (data: string) => await reader(folder).activities.getGeoJsonFromGPX(data),
    getGeoJson: async (id: string) => await reader(folder).activities.getGeoJson(id),
    parseFileToPoints: async (id: string) => await reader(folder).activities.parseFileToPoints(id),
    parseGPXToPoints: async (data: string) => await reader(folder).activities.parseGPXToPoints(data),
    parseGeoJsonToPoints: async (data: any) => await reader(folder).activities.parseGeoJsonToPoints(data),
}