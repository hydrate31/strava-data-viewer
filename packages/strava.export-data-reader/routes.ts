import { parse } from "@std/csv/parse";
import route_columns from "./data/route-columns.ts";

import { IRoute } from "./interface/route.ts";
import { gpx } from "npm:@tmcw/togeojson";
import { DOMParser } from "npm:xmldom";

export default (folder: string) => ({
  get: async (): Promise<IRoute[]> => {
    const data = await Deno.readTextFile(`./data/${folder}/routes.csv`);
    const routes: IRoute[] = parse(data, {
      columns: route_columns,
      skipFirstRow: true,
      skipEmptyLines: true,
      trim: true,
      delimiter: ",",
      emptyValue: null,
    }) as any;

    return routes;
  },

  getGeoJson: async (file: string): Promise<string> => {
    const normalized = file.replaceAll("\\", "/").replace(/^\/+/, "");
    if (!normalized.startsWith("routes/") || normalized.includes("..")) {
      throw new Error(`Invalid route file path: ${file}`);
    }

    const gpxData = await Deno.readTextFile(`./data/${folder}/${normalized}`);
    const gpxXml = new DOMParser().parseFromString(gpxData, "text/xml");
    const geojson = gpx(gpxXml);
    return JSON.stringify(geojson);
  },
});
