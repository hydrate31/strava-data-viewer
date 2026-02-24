import { Head } from "$fresh/runtime.ts";
import { FreshContext, Handlers, PageProps } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IApplication } from "../../packages/strava.export-data-reader/interface/application.ts";
import { IConnectedApp } from "../../packages/strava.export-data-reader/interface/connected_app.ts";
import { IEmailPreference } from "../../packages/strava.export-data-reader/interface/email_preference.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";
import StatePanel from "../../components/StatePanel.tsx";

interface Props {
  profile: IProfile;
  media: IMedia[];
  applications: IApplication[];
  connectedApps: IConnectedApp[];
  emailPreferences: IEmailPreference | null;
}

const isEnabledPreference = (value: unknown) => {
  return String(value).toLowerCase() === "true";
};

const humanizePreferenceKey = (key: string) => {
  return key
    .replace(/^when_/i, "When ")
    .replace(/^recieve_/i, "Receive ")
    .replace(/_/g, " ")
    .replace(/\bi\b/g, "I")
    .replace(/\bstrava\b/gi, "Strava")
    .replace(/\bkudos\b/gi, "Kudos")
    .replace(/\bkom\b/gi, "KOM")
    .replace(/\bqom\b/gi, "QOM")
    .replace(/\bcr\b/gi, "CR")
    .replace(/\blcl\b/gi, "LCL")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const handler: Handlers<Props> = {
  async GET(_req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const strava = new StravaDataService(folder);

    const profile = await strava.profile.get();
    const media = await strava.profile.getMedia();
    const applications = await strava.profile.getApplications();
    const connectedApps = await strava.profile.getConnectedApps();
    const emailPreferences = await strava.profile.getEmailPreferences();

    return ctx.render({
      profile,
      media,
      applications,
      connectedApps,
      emailPreferences,
    });
  },
};

export const User = ({ data }: PageProps<Props>) => (
  <>
    <Head>
      <title>User</title>
    </Head>

    <section>
      <h2>Connected Apps</h2>
      {data.connectedApps.length > 0 && (
        <div class="table-scroll">
          <table class="responsive-table">
            <thead>
              <tr>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {data.connectedApps.map((app) => (
                <tr>
                  <td data-label="Name">{app.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.connectedApps.length == 0 && (
        <StatePanel
          title="No connected apps found"
          description="Your export does not include connected app entries."
          actions={[
            { href: "/upload", label: "Re-import data", primary: true },
            { href: "/data-health", label: "Open Data Health" },
          ]}
        />
      )}
    </section>
    <br />

    <section>
      <h2>Applications</h2>
      {data.applications.length > 0 && (
        <div class="table-scroll">
          <table class="responsive-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {data.applications.map((app) => (
                <tr>
                  <td data-label="Name">{app.name}</td>
                  <td data-label="Description">{app.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.applications.length == 0 && (
        <StatePanel
          title="No applications found"
          description="No authorized application records were found in this export."
          actions={[
            { href: "/upload", label: "Re-import data", primary: true },
            { href: "/profile", label: "Back to overview" },
          ]}
        />
      )}
    </section>
    <br />

    <section>
      <h2>Email Preferences</h2>
      {data.emailPreferences && (
        <div class="table-scroll">
          <table class="responsive-table">
            <thead>
              <tr>
                <th>Preference</th>
                <th>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.emailPreferences).map(([key, value]) => (
                <tr>
                  <td data-label="Preference">{humanizePreferenceKey(key)}</td>
                  <td data-label="Enabled">
                    <input
                      type="checkbox"
                      checked={isEnabledPreference(value)}
                      disabled
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!data.emailPreferences && (
        <StatePanel
          title="No email preferences found"
          description="Email preference data is missing in this export."
          actions={[
            { href: "/upload", label: "Re-import data", primary: true },
            { href: "/data-health", label: "Check dataset health" },
          ]}
        />
      )}
    </section>
  </>
);

export default User;
