import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { TaskType } from "../packages/sdev.tasks/interfaces/task-type.ts";
import sdevTasks from "../packages/sdev.tasks/index.ts";
import { StravaDataService } from "../packages/strava.data.service/index.ts";
import { fileExists } from "../packages/strava.export-data-reader/helpers/fileExists.ts";

interface Props {
    health: {
        datasets: {
            name: string
            file: string
            required: boolean
            status: "ok" | "missing" | "parse_failed"
            records: string
            modified: string
        }[]
        processing: {
            name: string
            status: string
            modified: string
        }[]
    }
}

const formatDate = (date: Date | null | undefined) => {
    return date ? date.toISOString() : "-";
};

const latestModifiedInDir = async (path: string): Promise<Date | null> => {
    let latest: Date | null = null;
    if (!await fileExists(path)) return latest;

    for await (const entry of Deno.readDir(path)) {
        if (!entry.isFile) continue;
        const stat = await Deno.stat(`${path}/${entry.name}`);
        const current = stat.mtime ?? null;
        if (!current) continue;

        if (!latest || current.getTime() > latest.getTime()) {
            latest = current;
        }
    }
    return latest;
};

const recordCount = (data: unknown): string => {
    if (Array.isArray(data)) return String(data.length);
    if (data === null || data === undefined) return "0";
    if (typeof data === "object") return "1";
    return "-";
};

export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder);

        const datasetChecks = [
            { name: "Profile", file: "profile.csv", required: true, load: () => strava.profile.get() },
            { name: "Media", file: "media.csv", required: false, load: () => strava.profile.getMedia() },
            { name: "Activities", file: "activities.csv", required: true, load: () => strava.activities.list() },
            { name: "Routes", file: "routes.csv", required: false, load: () => strava.routes.list() },
            { name: "Followers", file: "followers.csv", required: false, load: () => strava.profile.getFollowers() },
            { name: "Following", file: "following.csv", required: false, load: () => strava.profile.getFollowing() },
            { name: "Goals", file: "goals.csv", required: false, load: () => strava.profile.getGoals() },
            { name: "Global Challenges", file: "global_challenges.csv", required: false, load: () => strava.profile.getGlobalChallenges() },
            { name: "Group Challenges", file: "group_challenges.csv", required: false, load: () => strava.profile.getGroupChallenges() },
            { name: "Clubs", file: "clubs.csv", required: false, load: () => strava.profile.getClubs() },
            { name: "Events", file: "events.csv", required: false, load: () => strava.profile.getEvents() },
            { name: "Comments", file: "comments.csv", required: false, load: () => strava.profile.getComments() },
            { name: "Contacts", file: "contacts.csv", required: false, load: () => strava.profile.getContacts() },
            { name: "Blocks", file: "blocks.csv", required: false, load: () => strava.profile.getBlocks() },
            { name: "Connected Apps", file: "connected_apps.csv", required: false, load: () => strava.profile.getConnectedApps() },
            { name: "Applications", file: "applications.csv", required: false, load: () => strava.profile.getApplications() },
            { name: "Email Preferences", file: "email_preferences.csv", required: false, load: () => strava.profile.getEmailPreferences() },
            { name: "Bikes", file: "bikes.csv", required: false, load: () => strava.gear.bikes() },
            { name: "Shoes", file: "shoes.csv", required: false, load: () => strava.gear.shoes() },
            { name: "Components", file: "components.csv", required: false, load: () => strava.gear.components() },
            { name: "Segments", file: "segments.csv", required: false, load: () => strava.segments.list() },
        ];

        const datasets: Props["health"]["datasets"] = [];
        for (const check of datasetChecks) {
            const fullPath = `./data/${folder}/${check.file}`;
            const exists = await fileExists(fullPath);
            const stat = exists ? await Deno.stat(fullPath) : null;

            if (!exists) {
                datasets.push({
                    name: check.name,
                    file: check.file,
                    required: check.required,
                    status: "missing",
                    records: "-",
                    modified: "-",
                });
                continue;
            }

            try {
                const result = await check.load();
                datasets.push({
                    name: check.name,
                    file: check.file,
                    required: check.required,
                    status: "ok",
                    records: recordCount(result),
                    modified: formatDate(stat?.mtime),
                });
            } catch {
                datasets.push({
                    name: check.name,
                    file: check.file,
                    required: check.required,
                    status: "parse_failed",
                    records: "-",
                    modified: formatDate(stat?.mtime),
                });
            }
        }

        const processing: Props["health"]["processing"] = [
            {
                name: "Heatmap",
                status: await sdevTasks.status(TaskType.GenerateHeatmap, folder),
                modified: formatDate((await Deno.stat(`./data/${folder}/heatmap/heatmap.json`).catch(() => ({ mtime: null } as Deno.FileInfo))).mtime),
            },
            {
                name: "Activity Images",
                status: await sdevTasks.status(TaskType.GenerateActivityImages, folder),
                modified: formatDate(await latestModifiedInDir(`./data/${folder}/activity-images`)),
            },
            {
                name: "Route Images",
                status: await sdevTasks.status(TaskType.GenerateRouteImages, folder),
                modified: formatDate(await latestModifiedInDir(`./data/${folder}/route-images`)),
            },
            {
                name: "Athlete Cache",
                status: await sdevTasks.status(TaskType.ProcessAthletes, folder),
                modified: formatDate(await latestModifiedInDir(`./data/${folder}/athletes`)),
            },
        ];

        return ctx.render({
            health: {
                datasets,
                processing,
            },
        });
    },
};

export const DataHealth = (props: PageProps<Props>) => <>
    <Head>
        <title>Data Health</title>
    </Head>
    <div class="data-health-page">
        <section>
            <h3>Data Health</h3>
            <h4>Datasets</h4>
            <table>
                <thead>
                    <tr>
                        <th>Dataset</th>
                        <th>Status</th>
                        <th>Required</th>
                        <th>Records</th>
                        <th>File</th>
                        <th>Modified</th>
                    </tr>
                </thead>
                <tbody>
                    {props.data.health.datasets.map((dataset) => <tr>
                        <td>{dataset.name}</td>
                        <td>{dataset.status}</td>
                        <td>{dataset.required ? "Yes" : "No"}</td>
                        <td>{dataset.records}</td>
                        <td><code>{dataset.file}</code></td>
                        <td>{dataset.modified}</td>
                    </tr>)}
                </tbody>
            </table>

            <h4>Processing</h4>
            <table>
                <thead>
                    <tr>
                        <th>Pipeline</th>
                        <th>Status</th>
                        <th>Last Output</th>
                    </tr>
                </thead>
                <tbody>
                    {props.data.health.processing.map((entry) => <tr>
                        <td>{entry.name}</td>
                        <td>{entry.status}</td>
                        <td>{entry.modified}</td>
                    </tr>)}
                </tbody>
            </table>
        </section>
    </div>
</>

export default DataHealth;
