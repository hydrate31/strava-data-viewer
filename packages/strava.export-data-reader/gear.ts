import { parse } from "@std/csv/parse";
import shoe_columns from "./data/shoe-columns.ts";
import bike_columns from "./data/bike-columns.ts";
import component_columns from "./data/component-columns.ts";

import { IBike } from "./interface/bike.ts";
import { IComponent } from "./interface/component.ts";
import { IShoe } from "./interface/shoe.ts";



export default (folder: string) => ({
    getBikes: async (): Promise<IBike[]> => {
        const data = await Deno.readTextFile(`./data/${folder}/bikes.csv`);
        const component: IBike[] = parse(data, {
            columns: bike_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;

        return component;
    },
    
    getComponents: async (): Promise<IComponent[]> => {
        const data = await Deno.readTextFile(`./data/${folder}/components.csv`);
        const component: IComponent[] = parse(data, {
            columns: component_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;

        return component;
    },

    getShoes: async (): Promise<IShoe[]> => {
        const data = await Deno.readTextFile(`./data/${folder}/shoes.csv`);
        const shoes: IShoe[] = parse(data, {
            columns: shoe_columns,
            skipFirstRow: true,
            skipEmptyLines: true,
            trim: true,
            delimiter: ',',
            emptyValue: null
        }) as any;

        return shoes;
    },
})
