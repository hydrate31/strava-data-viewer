import { parse } from "@std/csv/parse";
import columns from "./data/activities-columns.ts";
import { IActivity } from "./interface/activity.ts";

import { gpx } from "npm:@tmcw/togeojson";
import { DOMParser } from "npm:xmldom";
import { fileExists } from "./helpers/fileExists.ts";
import { parseFitFile } from "./helpers/parseFitFile.ts";

const emptyFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const normalizeActivityId = (id: string) =>
  id.replaceAll("\\", "/")
    .split("/")
    .pop()
    ?.replace(/\.(gpx|fit|gz)$/i, "")
    .replace(/[^a-zA-Z0-9._-]/g, "") ?? "";

const semicircleToDegrees = (value: number) => value * (180 / 2 ** 31);

const normalizeCoordinate = (
  value: number,
  isLatitude: boolean,
): number | null => {
  if (!Number.isFinite(value)) return null;
  const max = isLatitude ? 90 : 180;

  if (Math.abs(value) <= max) return value;

  const converted = semicircleToDegrees(value);
  if (Math.abs(converted) <= max) return converted;

  return null;
};

const fitRecordsToCoordinates = (records: any[]): number[][] => {
  const coordinates: number[][] = [];

  for (const record of records ?? []) {
    const rawLat = Number(record?.position_lat);
    const rawLng = Number(record?.position_long);
    const lat = normalizeCoordinate(rawLat, true);
    const lng = normalizeCoordinate(rawLng, false);

    if (lat == null || lng == null) continue;
    coordinates.push([lng, lat]);
  }

  return coordinates;
};

const fitToGeoJson = (fitData: any) => {
  const topLevelRecords = Array.isArray(fitData?.records)
    ? fitData.records
    : [];
  const nestedSessionRecords = Array.isArray(fitData?.sessions)
    ? fitData.sessions.flatMap((session: any) =>
      Array.isArray(session?.records) ? session.records : []
    )
    : [];
  const nestedActivitySessionRecords =
    Array.isArray(fitData?.activity?.sessions)
      ? fitData.activity.sessions.flatMap((session: any) =>
        Array.isArray(session?.records) ? session.records : []
      )
      : [];
  const nestedLapRecords = Array.isArray(fitData?.activity?.sessions)
    ? fitData.activity.sessions.flatMap((session: any) =>
      Array.isArray(session?.laps)
        ? session.laps.flatMap((lap: any) =>
          Array.isArray(lap?.records) ? lap.records : []
        )
        : []
    )
    : [];
  const records = [
    ...topLevelRecords,
    ...nestedSessionRecords,
    ...nestedActivitySessionRecords,
    ...nestedLapRecords,
  ];
  const coordinates = fitRecordsToCoordinates(records);

  if (coordinates.length === 0) return emptyFeatureCollection;

  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates,
      },
      properties: {},
    }],
  };
};

export default (folder: string) => ({
  get: async (): Promise<IActivity[]> => {
    const data = await Deno.readTextFile(`./data/${folder}/activities.csv`);
    const activities: IActivity[] = parse(data, {
      columns,
      skipFirstRow: true,
      skipEmptyLines: true,
      trim: true,
      delimiter: ",",
      emptyValue: null,
    }) as any;

    return activities;
  },
  getGPX: async (id: string): Promise<string> => {
    const fileId = normalizeActivityId(id);
    if (!fileId || fileId.includes("..")) {
      throw new Error(`Invalid activity id: ${id}`);
    }
    const data = await Deno.readTextFile(
      `./data/${folder}/activities/${fileId}.gpx`,
    );

    return data;
  },

  getGeoJson: async (id: string): Promise<string> => {
    const fileId = normalizeActivityId(id);
    if (!fileId || fileId.includes("..")) {
      return JSON.stringify(emptyFeatureCollection);
    }

    const gpxFileExists = await fileExists(
      `./data/${folder}/activities/${fileId}.gpx`,
    );
    if (gpxFileExists) {
      const gpxData = await Deno.readTextFile(
        `./data/${folder}/activities/${fileId}.gpx`,
      );
      const gpxXml = new DOMParser().parseFromString(gpxData, "text/xml");
      const geojson = gpx(gpxXml);
      return JSON.stringify(geojson);
    }

    const fitFileExists = await fileExists(
      `./data/${folder}/activities/${fileId}.fit`,
    );
    if (fitFileExists) {
      try {
        const fitData = await Deno.readFile(
          `./data/${folder}/activities/${fileId}.fit`,
        );
        const fit = await parseFitFile(fitData);
        return JSON.stringify(fitToGeoJson(fit));
      } catch (error) {
        console.warn(`Failed to parse FIT file for activity ${fileId}`, error);
      }
    }

    return JSON.stringify(emptyFeatureCollection);
  },
  getGeoJsonFromGPX: async (gpxData: string): Promise<any> => {
    const gpxXml = new DOMParser().parseFromString(gpxData, "text/xml");
    const geojson = gpx(gpxXml);
    return geojson;
  },
  parseFileToPoints: async (id: string): Promise<number[][]> => {
    const fileId = normalizeActivityId(id);
    if (!fileId || fileId.includes("..")) return [];

    const gpxFileExists = await fileExists(
      `./data/${folder}/activities/${fileId}.gpx`,
    );
    if (gpxFileExists) {
      const gpxData = await Deno.readTextFile(
        `./data/${folder}/activities/${fileId}.gpx`,
      );
      const gpxXml = new DOMParser().parseFromString(gpxData, "text/xml");
      const geojson = gpx(gpxXml);
      const coordinates = (geojson.features[0].geometry as any).coordinates;
      return coordinates;
    }

    const fitFileExists = await fileExists(
      `./data/${folder}/activities/${fileId}.fit`,
    );
    if (fitFileExists) {
      try {
        const fitData = await Deno.readFile(
          `./data/${folder}/activities/${fileId}.fit`,
        );
        const fit = await parseFitFile(fitData);
        const geojson = fitToGeoJson(fit);
        const feature = geojson.features[0] as any;
        return feature?.geometry?.coordinates ?? [];
      } catch (error) {
        console.warn(
          `Failed to parse FIT points for activity ${fileId}`,
          error,
        );
      }
    }

    return [];
  },

  parseGPXToPoints: async (gpxData: string): Promise<number[][]> => {
    let geojson = null;
    const gpxXml = new DOMParser().parseFromString(gpxData, "text/xml");
    geojson = gpx(gpxXml);
    const coordinates = (geojson.features[0].geometry as any).coordinates;
    return coordinates;
  },

  parseGeoJsonToPoints: async (geojson: any): Promise<Set<number[][]>> => {
    const coordinates: Set<number[][]> = new Set(); //geojson.features.map((f: any) => f.geometry?.coordinates ?? []);
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
  },
});
