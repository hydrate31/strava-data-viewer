import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import service from "../packages/strava.data.service/index.ts";
import {
    compress,
    decompress
} from "https://deno.land/x/zip@v1.2.5/mod.ts";
import compressing from "npm:compressing";
import { fileExists } from "../packages/strava.export-data-reader/helpers/fileExists.ts";



interface Props {
    message: string | null;
}

const extractExportFile = async () => {
    if (await fileExists("./data/export")) {
        await Deno.remove("./data/export", { recursive: true })
    }
    try {
        await decompress("./data/export.zip", "./data", {
            includeFileName: true,
        });
    }
    catch {}
}

const extractActivities = async () => {
    const activitiesDir = "./data/export/activities";
    for await (const dirEntry of Deno.readDir(activitiesDir)) {
        if (dirEntry.name.endsWith(".gz")) {
            await compressing.gzip.uncompress(`${activitiesDir}/${dirEntry.name}`, `${activitiesDir}/${dirEntry.name.replace('.gz', '')}`)
            await Deno.remove(`${activitiesDir}/${dirEntry.name}`)
        }
    }

    await Deno.mkdir(`./data/export/heatmap/`)
    for await (const dirEntry of Deno.readDir(activitiesDir)) {
        if (dirEntry.name.endsWith(".gpx")) {
            const id  = dirEntry.name.replace(".gpx", "")
            const { activity, geoJson } = await service.activities.get(dirEntry.name.replace(".gpx", ""));await service.activities.get(dirEntry.name.replace(".gpx", ""));
            const points = await service.activities.parseGeoJsonToPoints(id);
            const json = {
                points: points.map(point => [point[0], point[1]])
            }
            await Deno.writeTextFile(`./data/export/heatmap/${id}.json`, JSON.stringify(json));
        }
    }

}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        return ctx.render({ });
    },
    async POST(_req: Request, ctx: FreshContext) {
        const form = await _req.formData();
        const file = form.get("export_file") as File;

        if (!file) {
            return ctx.render({
                message: `Error: File not provided. Please try again`,
            });
        }
        const reader = file.stream().getReader();
        const result = await reader.read();

        const exportZipFile = `./data/${'export'}.zip`

        if (result.value) {
            if (await fileExists(exportZipFile)) {
                await Deno.remove(exportZipFile)
            }
            await Deno.writeFile(exportZipFile, result.value);
            
            await extractExportFile();
            await extractActivities();


            if (await fileExists(exportZipFile)) {
                await Deno.remove(exportZipFile)
            }
        }
        else {
            return ctx.render({
                message: `Error: Failed to store file. Please try again`,
            });
        }

        const { pathname } = new URL(_req.url);
        const fullUrl = _req.url.replace(pathname, "");

        return Response.redirect(fullUrl + "/profile")
    }
};

export const Routes = ({ data }: PageProps<Props>) => <>
    <Head>
        <title>Upload</title>
    </Head>
    <h1>Upload</h1>
    <p>Upload your strava export zip.</p>
    <form method="post" encType="multipart/form-data">
        <input type="file" name="export_file" />

        <button type="submit">Upload</button>
    </form>
    <br />

    <p>{data.message}</p>
    <br />

    <p>
        If you find yourself constantly redirected to this page it means that you have either not uploaded your exported data from Strava or there is a problem with the data.
    </p>
    <p>The data should be a zip file and should be called something like <code>export_98795663.zip</code>.</p>

    <p>When last checked, you can get your Strava data zip by going to <a href="https://www.strava.com/account">Strava Account</a>, scrolling down to <strong>Download or Delete Your Account</strong> and clicking <strong>Get Started</strong>. Find <strong>Download Request (optional)</strong> which should be step 2, and click <strong>Request Your Archive</strong>.</p>
    <p>Strava will take some time to process this file - and a zip file should be sent to your email address for your Strava Account.</p>

    <p>
        Please note that due to processing of all of your activities that the processing of this upload may take several minutes.
    </p>
    
</>

export default Routes