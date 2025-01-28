import { type PageProps } from "$fresh/server.ts";
export default function App({ Component, state }: PageProps, ctx: any) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Strava Data Viewer</title>
        <link rel="stylesheet" href="/styles.css" />
        <script src="https://unpkg.com/feather-icons"></script>
      </head>
      <body>
        <main>
          <Component />

        </main>
        <footer>
          plop
        </footer>
        <script>feather.replace();</script>
      </body>
    </html>
  );
}
