import { parse } from "@std/csv/parse";
import segment_columns from "./data/segment-columns.ts";

import { ISegment } from "./interface/segment.ts";

export default {
    get: async (): Promise<ISegment[]> => {
        const data = await Deno.readTextFile("./data/export/bikes.csv");
        const segments: ISegment[] = parse(data, {
            columns: segment_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;

        return segments;
    },
}