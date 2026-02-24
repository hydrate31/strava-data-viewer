import { Head } from "$fresh/runtime.ts";
import { FreshContext, Handlers, PageProps } from "$fresh/src/server/types.ts";
import { decompress } from "https://deno.land/x/zip@v1.2.5/mod.ts";
import { fileExists } from "../packages/strava.export-data-reader/helpers/fileExists.ts";
import sdevTasks from "../packages/sdev.tasks/index.ts";
import { TaskType } from "../packages/sdev.tasks/interfaces/task-type.ts";
import { QueueEntry } from "../packages/sdev.tasks/interfaces/queue-entry.ts";
import UploadDropzone from "../islands/UploadDropzone.tsx";
import TimeAgo from "../components/TimeAgo.tsx";
import StatePanel from "../components/StatePanel.tsx";

type ImportStage =
  | "uploaded"
  | "validating"
  | "validated"
  | "importing"
  | "completed"
  | "failed";
type ConflictPolicy = "replace" | "abort";

interface ImportPreview {
  sourceRoot: string;
  requiredFiles: { name: string; exists: boolean }[];
  totalFiles: number;
  activityFiles: number;
  routeFiles: number;
  hasConflicts: boolean;
}

interface ImportState {
  userId: string;
  stage: ImportStage;
  progress: number;
  updatedAt: string;
  message: string;
  zipPath: string;
  workDir: string;
  preview?: ImportPreview;
  conflictPolicy?: ConflictPolicy;
}

interface Props {
  message: string | null;
  importState: ImportState | null;
}

const IMPORT_STATE_DIR = "./data/import-state";
const IMPORT_WORK_DIR = "./data/import-work";

const now = () => new Date().toISOString();

const ensureDir = async (path: string) => {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch {
    // no-op
  }
};

const importStatePath = (userId: string) =>
  `${IMPORT_STATE_DIR}/${userId}.json`;
const importZipPath = (userId: string) => `${IMPORT_STATE_DIR}/${userId}.zip`;
const importWorkDir = (userId: string) => `${IMPORT_WORK_DIR}/${userId}`;

const listFilesRecursive = async (path: string): Promise<string[]> => {
  const files: string[] = [];
  for await (const entry of Deno.readDir(path)) {
    const full = `${path}/${entry.name}`;
    if (entry.isFile) {
      files.push(full);
    } else if (entry.isDirectory) {
      files.push(...await listFilesRecursive(full));
    }
  }
  return files;
};

const findSourceRoot = async (workDir: string): Promise<string | null> => {
  if (!await fileExists(workDir)) return null;

  const candidates = [workDir];
  while (candidates.length > 0) {
    const current = candidates.shift() as string;
    if (await fileExists(`${current}/profile.csv`)) return current;

    for await (const entry of Deno.readDir(current)) {
      if (entry.isDirectory) {
        candidates.push(`${current}/${entry.name}`);
      }
    }
  }

  return null;
};

const buildPreview = async (
  userId: string,
  sourceRoot: string,
): Promise<ImportPreview> => {
  const requiredNames = ["profile.csv", "activities.csv"];
  const requiredFiles = [];
  for (const name of requiredNames) {
    requiredFiles.push({
      name,
      exists: await fileExists(`${sourceRoot}/${name}`),
    });
  }

  const allFiles = await listFilesRecursive(sourceRoot);
  const activityFiles =
    allFiles.filter((file) =>
      file.includes("/activities/") &&
      (file.endsWith(".gpx") || file.endsWith(".fit") || file.endsWith(".gz"))
    ).length;
  const routeFiles =
    allFiles.filter((file) =>
      file.includes("/routes/") && file.endsWith(".gpx")
    ).length;
  const hasConflicts = await fileExists(`./data/${userId}/profile.csv`);

  return {
    sourceRoot,
    requiredFiles,
    totalFiles: allFiles.length,
    activityFiles,
    routeFiles,
    hasConflicts,
  };
};

const readImportState = async (userId: string): Promise<ImportState | null> => {
  const path = importStatePath(userId);
  if (!await fileExists(path)) return null;

  try {
    const text = await Deno.readTextFile(path);
    return JSON.parse(text) as ImportState;
  } catch {
    return null;
  }
};

const writeImportState = async (state: ImportState) => {
  await ensureDir(IMPORT_STATE_DIR);
  await Deno.writeTextFile(
    importStatePath(state.userId),
    JSON.stringify(state, null, 2),
  );
};

const cleanupImportArtifacts = async (state: ImportState | null) => {
  if (!state) return;

  if (state.workDir && await fileExists(state.workDir)) {
    await Deno.remove(state.workDir, { recursive: true });
  }
  if (state.zipPath && await fileExists(state.zipPath)) {
    await Deno.remove(state.zipPath);
  }

  const path = importStatePath(state.userId);
  if (await fileExists(path)) {
    await Deno.remove(path);
  }
};

const enqueuePostImportTasks = async (userId: string) => {
  if (
    await sdevTasks.status(TaskType.ProcessActivities, userId) !== "running"
  ) {
    await sdevTasks.enqueue({
      userId,
      type: TaskType.ProcessActivities,
      body: "Extract gzipped activities.",
    } as QueueEntry);
  }

  await sdevTasks.enqueue({
    userId,
    type: TaskType.ProcessAthletes,
    body: "Fetching athlete information...",
  } as QueueEntry);

  await sdevTasks.enqueue({
    userId,
    type: TaskType.GenerateRouteImages,
    body: "Generating route images.",
  } as QueueEntry);
};

const moveOrCopyDir = async (source: string, target: string) => {
  try {
    await Deno.rename(source, target);
    return;
  } catch {
    // fallback to recursive copy
  }

  await ensureDir(target);
  for await (const entry of Deno.readDir(source)) {
    const src = `${source}/${entry.name}`;
    const dst = `${target}/${entry.name}`;
    if (entry.isDirectory) {
      await moveOrCopyDir(src, dst);
    } else if (entry.isFile) {
      await Deno.copyFile(src, dst);
    }
  }
};

export const handler: Handlers<Props> = {
  async GET(_req: Request, ctx: FreshContext) {
    const userId = (ctx.state?.data as any)?.uid ?? "export";
    const importState = await readImportState(userId);
    return ctx.render({
      message: null,
      importState,
    });
  },

  async POST(req: Request, ctx: FreshContext) {
    const userId = (ctx.state?.data as any)?.uid ?? "export";
    const form = await req.formData();
    const action = form.get("action")?.toString() ?? "upload";

    let importState = await readImportState(userId);

    try {
      if (action === "reset") {
        await cleanupImportArtifacts(importState);
        return ctx.render({
          message: "Import session reset.",
          importState: null,
        });
      }

      if (action === "upload") {
        const file = form.get("export_file") as File | null;
        if (!file || file.size === 0) {
          return ctx.render({
            message: "Error: File not provided.",
            importState,
          });
        }

        await ensureDir(IMPORT_STATE_DIR);
        await ensureDir(IMPORT_WORK_DIR);

        if (importState) await cleanupImportArtifacts(importState);

        const zipPath = importZipPath(userId);
        const bytes = new Uint8Array(await file.arrayBuffer());
        await Deno.writeFile(zipPath, bytes);

        importState = {
          userId,
          stage: "uploaded",
          progress: 20,
          updatedAt: now(),
          message: "Archive uploaded. Run validation preview to continue.",
          zipPath,
          workDir: importWorkDir(userId),
        };
        await writeImportState(importState);

        return ctx.render({ message: "Upload complete.", importState });
      }

      if (!importState) {
        return ctx.render({
          message: "No active import session. Upload a zip first.",
          importState: null,
        });
      }

      if (action === "validate") {
        importState.stage = "validating";
        importState.progress = 35;
        importState.updatedAt = now();
        importState.message = "Validating archive and generating preview...";
        await writeImportState(importState);

        if (await fileExists(importState.workDir)) {
          await Deno.remove(importState.workDir, { recursive: true });
        }
        await ensureDir(importState.workDir);

        await decompress(importState.zipPath, importState.workDir, {
          includeFileName: true,
        });

        const sourceRoot = await findSourceRoot(importState.workDir);
        if (!sourceRoot) {
          importState.stage = "failed";
          importState.progress = 35;
          importState.updatedAt = now();
          importState.message =
            "Validation failed: Could not find profile.csv in archive.";
          await writeImportState(importState);
          return ctx.render({ message: importState.message, importState });
        }

        const preview = await buildPreview(userId, sourceRoot);
        const missingRequired = preview.requiredFiles.some((entry) =>
          !entry.exists
        );

        importState.preview = preview;
        importState.stage = missingRequired ? "failed" : "validated";
        importState.progress = missingRequired ? 35 : 50;
        importState.updatedAt = now();
        importState.message = missingRequired
          ? "Validation failed: Required files are missing."
          : "Validation complete. Choose conflict policy and start import.";
        await writeImportState(importState);

        return ctx.render({ message: importState.message, importState });
      }

      if (action === "import") {
        if (!importState.preview) {
          return ctx.render({
            message: "Run validation preview before import.",
            importState,
          });
        }

        const conflictPolicy = (form.get("conflict_policy")?.toString() ??
          "abort") as ConflictPolicy;
        importState.conflictPolicy = conflictPolicy;

        const targetDir = `./data/${userId}`;
        const hasExistingData = await fileExists(`${targetDir}/profile.csv`);

        if (hasExistingData && conflictPolicy === "abort") {
          importState.stage = "validated";
          importState.progress = 50;
          importState.updatedAt = now();
          importState.message =
            "Conflict detected. Choose Replace Existing to continue.";
          await writeImportState(importState);
          return ctx.render({ message: importState.message, importState });
        }

        importState.stage = "importing";
        importState.progress = 70;
        importState.updatedAt = now();
        importState.message = "Importing data...";
        await writeImportState(importState);

        if (hasExistingData && conflictPolicy === "replace") {
          await Deno.remove(targetDir, { recursive: true });
        }

        await ensureDir("./data");
        await moveOrCopyDir(importState.preview.sourceRoot, targetDir);
        await enqueuePostImportTasks(userId);

        importState.stage = "completed";
        importState.progress = 100;
        importState.updatedAt = now();
        importState.message = "Import complete. Post-import tasks are running.";
        await writeImportState(importState);

        return ctx.render({ message: importState.message, importState });
      }

      return ctx.render({ message: "Unknown action.", importState });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (importState) {
        importState.stage = "failed";
        importState.updatedAt = now();
        importState.message = `Import failed: ${message}`;
        await writeImportState(importState);
      }
      return ctx.render({ message: `Import failed: ${message}`, importState });
    }
  },
};

const ImportProgress = ({ state }: { state: ImportState }) => (
  <div>
    <p>
      <strong>Stage:</strong> {state.stage}
    </p>
    <p>
      <strong>Updated:</strong> <TimeAgo value={state.updatedAt} />
    </p>
    <div
      class="task-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={state.progress}
    >
      <div
        class="task-progress-fill"
        style={`width: ${Math.max(0, Math.min(100, state.progress))}%;`}
      />
      <span class="task-progress-label">{state.progress}%</span>
    </div>
    <p>{state.message}</p>
  </div>
);

export default function UploadPage({ data }: PageProps<Props>) {
  const state = data.importState;
  const isErrorMessage = (data.message ?? "").toLowerCase().includes("error") ||
    (data.message ?? "").toLowerCase().includes("failed") ||
    (data.message ?? "").toLowerCase().includes("unknown action");

  return (
    <>
      <Head>
        <title>Upload</title>
      </Head>

      <h1>Upload</h1>
      <p>
        Import wizard: upload, validate, handle conflicts, and import with
        resumable state.
      </p>
      <section>
        <h3>Instructions</h3>
        <p>
          Export your data from Strava as a full account export zip, then upload
          the original zip file here (do not unzip it first).
        </p>
        <p>
          Required files include <code>profile.csv</code> and{" "}
          <code>activities.csv</code>. Activity files should be present under
          {" "}
          <code>activities/</code> (for example <code>.fit</code>,{" "}
          <code>.gpx</code>, or <code>.gz</code>).
        </p>
        <p>
          If you already imported data, choose a conflict policy before running
          the import. <strong>Abort</strong> keeps existing data unchanged, and
          {" "}
          <strong>Replace</strong> overwrites the current dataset for this user.
        </p>
      </section>

      {!state && (
        <section>
          <h3>Step 1: Upload Archive</h3>
          <UploadDropzone action="/upload" />
        </section>
      )}

      {state && (
        <section>
          <h3>Import Session</h3>
          <ImportProgress state={state} />
        </section>
      )}

      {state && (state.stage === "uploaded" || state.stage === "failed") && (
        <section>
          <h3>Step 2: Validation Preview</h3>
          <form method="post">
            <input type="hidden" name="action" value="validate" />
            <button type="submit">Run Validation Preview</button>
          </form>
        </section>
      )}

      {state?.preview && (
        <section>
          <h3>Validation Preview</h3>
          <div class="table-scroll">
            <table class="responsive-table">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="Check">Source Root</td>
                  <td data-label="Result">
                    <code>{state.preview.sourceRoot}</code>
                  </td>
                </tr>
                <tr>
                  <td data-label="Check">Total Files</td>
                  <td data-label="Result">{state.preview.totalFiles}</td>
                </tr>
                <tr>
                  <td data-label="Check">Activity Files</td>
                  <td data-label="Result">{state.preview.activityFiles}</td>
                </tr>
                <tr>
                  <td data-label="Check">Route Files</td>
                  <td data-label="Result">{state.preview.routeFiles}</td>
                </tr>
                <tr>
                  <td data-label="Check">Existing Data Conflict</td>
                  <td data-label="Result">
                    {state.preview.hasConflicts ? "Yes" : "No"}
                  </td>
                </tr>
                {state.preview.requiredFiles.map((required) => (
                  <tr>
                    <td data-label="Check">
                      Required: <code>{required.name}</code>
                    </td>
                    <td data-label="Result">
                      {required.exists ? "Present" : "Missing"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {state?.preview && state.stage === "validated" && (
        <section>
          <h3>Step 3: Conflict Handling + Import</h3>
          <form method="post">
            <input type="hidden" name="action" value="import" />
            <label>
              <input
                type="radio"
                name="conflict_policy"
                value="abort"
                checked={state.preview.hasConflicts ? true : undefined}
              />
              Abort if existing data is detected
            </label>
            <br />
            <label>
              <input
                type="radio"
                name="conflict_policy"
                value="replace"
                checked={!state.preview.hasConflicts ? true : undefined}
              />
              Replace existing data
            </label>
            <br />
            <button type="submit">Start Import</button>
          </form>
        </section>
      )}

      {state?.stage === "completed" && (
        <section>
          <h3>Import Completed</h3>
          <p>
            Data is imported. Background tasks are queued/running for activity
            processing, athletes, and route images.
          </p>
          <p>
            <a href="/tasks">Open Tasks</a>
          </p>
          <p>
            <a href="/profile">Go to Profile</a>
          </p>
        </section>
      )}

      {state && (
        <section>
          <form
            method="post"
            {...({
              onsubmit:
                "return confirm('Reset import session and delete temporary import artifacts?');",
            } as any)}
          >
            <input type="hidden" name="action" value="reset" />
            <button type="submit" class="danger">Reset Import Session</button>
          </form>
        </section>
      )}

      {data.message && (
        <StatePanel
          kind={isErrorMessage ? "error" : "info"}
          title={data.message}
          actions={[
            { href: "/upload", label: "Refresh", primary: true },
            { href: "/tasks", label: "Open Tasks" },
          ]}
        />
      )}

      <p>
        If you are repeatedly redirected here, either no valid export is
        imported yet or validation is failing.
      </p>
      <p>
        The file should be a Strava export zip, e.g.{" "}
        <code>export_98795663.zip</code>.
      </p>
    </>
  );
}
