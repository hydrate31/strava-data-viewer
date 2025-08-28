
import athletes from "./athletes.ts";

export default (folder: string) => ({
    athletes: athletes(folder),
})