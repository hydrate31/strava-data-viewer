
import activities from "./activities.ts";
import gear from "./gear.ts";
import profile from "./profile.ts";
import routes from "./routes.ts";
import segments from "./segments.ts";

export default (folder: string) => ({
    activities: activities(folder),
    gear: gear(folder),
    profile: profile(folder),
    routes: routes(folder),
    segments: segments(folder),
})