import { parse } from "@std/csv/parse";
import columns from "./data/activities-columns.ts";
import { IActivity } from "./interface/activity.ts";

import { gpx } from "npm:@tmcw/togeojson"
import { DOMParser } from "npm:xmldom"
import { fileExists } from "./helpers/fileExists.ts";
import { parseFitFile } from "./helpers/parseFitFile.ts";



export default {
    get: async (): Promise<IActivity[]> => {
        const data = await Deno.readTextFile("./data/export/activities.csv");
        const activities: IActivity[] = parse(data, {
            columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;

        return activities;
    },
    getGPX: async (id: string): Promise<string> => {
        const data = await Deno.readTextFile(`./data/export/activities/${id}.gpx`);
        
        return data;
    },

    getGeoJson: async (id: string): Promise<string> => {
        const gpxFileExists = await fileExists(`./data/export/activities/${id}.gpx`);
        if (gpxFileExists) {
            const gpxData = await Deno.readTextFile(`./data/export/activities/${id}.gpx`);
            const gpxXml = new DOMParser().parseFromString(gpxData, "text/xml");
            const geojson = gpx(gpxXml);
            return JSON.stringify(geojson);
        }

        const fitFileExists = await fileExists(`./data/export/activities/${id}.fit`);
        if (gpxFileExists) {
            const fitData = await Deno.readTextFile(`./data/export/activities/${id}.fit`);
            if (fitData) {
                const result = await parseFitFile(fitData);
                
                return JSON.stringify('');
            }
            else {
                return ""
            }
        }
        else {
            return ""
        }
    },
    parseGeoJsonToPoints: async (id: string): Promise<number[][]> => {
        let geojson = null;
        const gpxFileExists = await fileExists(`./data/export/activities/${id}.gpx`);
        if (gpxFileExists) {
            const gpxData = await Deno.readTextFile(`./data/export/activities/${id}.gpx`);
            const gpxXml = new DOMParser().parseFromString(gpxData, "text/xml");
            geojson = gpx(gpxXml);
            const coordinates = geojson.features[0].geometry.coordinates
            return coordinates;
        }

        const fitFileExists = await fileExists(`./data/export/activities/${id}.fit`);
        if (gpxFileExists) {
            const fitData = await Deno.readTextFile(`./data/export/activities/${id}.fit`);
            if (fitData) {
                const result = await parseFitFile(fitData);
                
                geojson = result;
                return []
            }
            else {
                return []
            }
        }
        else {
            return []
        }
    }
}