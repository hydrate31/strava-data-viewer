import { type PageProps } from "$fresh/server.ts";
export default function App({ Component, url }: PageProps, ctx: any) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Strava Data Viewer</title>
        <link rel="stylesheet" href="/styles.css" />
        {/*<script src="https://unpkg.com/feather-icons"></script>*/}
      </head>
      <body>
        <header>
          <nav>
              <li selected={url.pathname.startsWith('/profile') ? true : undefined}>
                <a href="/profile">Profile</a>
              </li>
              <li selected={url.pathname.startsWith('/heatmap') ? true : undefined}>
                <a href="/heatmap">Heatmap</a>
              </li>
          </nav>
        </header>
        <main>
          <Component />
        </main>
        {/*<script>feather.replace();</script>*/}
      </body>
    </html>
  );
}
