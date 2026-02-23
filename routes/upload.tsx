import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../packages/strava.data.service/index.ts";
import {
    decompress
} from "https://deno.land/x/zip@v1.2.5/mod.ts";
import { fileExists } from "../packages/strava.export-data-reader/helpers/fileExists.ts";
import sdevTasks from "../packages/sdev.tasks/index.ts";
import { QueueEntry } from "../packages/sdev.tasks/interfaces/queue-entry.ts";
import { TaskType } from "../packages/sdev.tasks/interfaces/task-type.ts";

interface Props {
    message: string | null;
}

const extractExportFile = async (filename: string) => {
    if (await fileExists(`./data/${filename}`)) {
        await Deno.remove(`./data/${filename}`, { recursive: true })
    }
    try {
        await decompress(`./data/${filename}.zip`, "./data", {
            includeFileName: true,
        });
    }
    catch {}
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

        const exportFilename = (ctx.state?.data as any)?.uid ?? 'export';

        const strava = new StravaDataService(exportFilename)

        const exportZipFile = `./data/${exportFilename}.zip`

        if (result.value) {
            if (await fileExists(exportZipFile)) {
                await Deno.remove(exportZipFile)
            }
            await Deno.writeFile(exportZipFile, result.value);
            console.info(' ------------ Extracting export archive ------------')
            await extractExportFile(exportFilename);
            console.info(' ------------ Finished: Extracting export archive ------------')

            if (await sdevTasks.status(TaskType.ProcessActivities, exportFilename) !== "running") {
                sdevTasks.enqueue({
                    userId: exportFilename,
                    type: TaskType.ProcessActivities,
                    body: "Extract gzipped activities."
                } as QueueEntry);
            }

            sdevTasks.enqueue({
                userId: exportFilename,
                type: TaskType.ProcessAthletes,
                body: "Fetching athelete information..."
            } as QueueEntry);

            sdevTasks.enqueue({
                userId: exportFilename,
                type: TaskType.GenerateRouteImages,
                body: "Generating route images."
            } as QueueEntry);

            console.info(' ------------ Cleanup ------------')
            if (await fileExists(exportZipFile)) {
                await Deno.remove(exportZipFile)
            }
            console.info(' ------------ Finished: Cleanup ------------')
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
