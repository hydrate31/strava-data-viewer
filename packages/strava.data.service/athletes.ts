import reader from "../strava.export-data-reader/index.ts";

const folder = 'export';
export default {
    list: async () => {
        const athletes = []
        for await (const dirEntry of Deno.readDir(`./data/export/athletes/`)) {
            if (dirEntry.isFile) {
                const json = JSON.parse(await Deno.readTextFile(`./data/export/athletes/${dirEntry.name}`));
                athletes.push(json);
            }
        }
        return athletes
    },
}