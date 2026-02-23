import { parse } from "@std/csv/parse";
import columns from "./data/activities-columns.ts";
import { IActivity } from "./interface/activity.ts";

import { gpx } from "npm:@tmcw/togeojson"
import { DOMParser } from "npm:xmldom"
import { fileExists } from "./helpers/fileExists.ts";
import { parseFitFile } from "./helpers/parseFitFile.ts";

export default (folder: string) => ({
    get: async (): Promise<IActivity[]> => {
        const data = await Deno.readTextFile(`./data/${folder}/activities.csv`);
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
        const data = await Deno.readTextFile(`./data/${folder}/activities/${id}.gpx`);
        
        return data;
    },

    getGeoJson: async (id: string): Promise<string> => {
        const gpxFileExists = await fileExists(`./data/${folder}/activities/${id}.gpx`);
        if (gpxFileExists) {
            const gpxData = await Deno.readTextFile(`./data/${folder}/activities/${id}.gpx`);
            const gpxXml = new DOMParser().parseFromString(gpxData, "text/xml");
            const geojson = gpx(gpxXml);
            return JSON.stringify(geojson);
        }
        else {
            return ""
        }
    },
    getGeoJsonFromGPX: async (gpxData: string): Promise<any> => {
        const gpxXml = new DOMParser().parseFromString(gpxData, "text/xml");
        const geojson = gpx(gpxXml);
        return geojson;
    },
    parseFileToPoints: async (id: string): Promise<number[][]> => {
        let geojson = null;
        const gpxFileExists = await fileExists(`./data/${folder}/activities/${id}.gpx`);
        if (gpxFileExists) {
            const gpxData = await Deno.readTextFile(`./data/${folder}/activities/${id}.gpx`);
            const gpxXml = new DOMParser().parseFromString(gpxData, "text/xml");
            geojson = gpx(gpxXml);
            const coordinates = (geojson.features[0].geometry as any).coordinates
            return coordinates;
        }
        else {
            return []
        }
    },

    parseGPXToPoints: async (gpxData: string): Promise<number[][]> => {
        let geojson = null;
        const gpxXml = new DOMParser().parseFromString(gpxData, "text/xml");
        geojson = gpx(gpxXml);
        const coordinates = (geojson.features[0].geometry as any).coordinates
        return coordinates;
    },

    parseGeoJsonToPoints: async (geojson: any): Promise<Set<number[][]>> => {
        const coordinates: Set<number[][]> = new Set //geojson.features.map((f: any) => f.geometry?.coordinates ?? []);
        for (const feature of geojson.features) {
            const geometry = feature.geometry;
            if (!geometry || !geometry.coordinates) continue;

            switch (geometry.type) {
            case "Point":
                coordinates.add(geometry.coordinates);
                break;

            case "MultiPoint":
                coordinates.add(geometry.coordinates);
                break;

            case "LineString":
                coordinates.add(geometry.coordinates);
                break;

            case "MultiLineString":
                for (const line of geometry.coordinates) {
                    coordinates.add(line);
                }
                break;

            case "Polygon":
                for (const ring of geometry.coordinates) {
                    coordinates.add(ring);
                }
                break;

            case "MultiPolygon":
                for (const polygon of geometry.coordinates) {
                    for (const ring of polygon) {
                        coordinates.add(ring);
                    }
                }
                break;

            default:
                console.warn(`Unsupported geometry type: ${geometry.type}`);
            }
        }
        return coordinates;
    }
})
