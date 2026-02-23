import { FreshContext } from "$fresh/server.ts";
import { fileExists } from "../packages/strava.export-data-reader/helpers/fileExists.ts";
import { resolveUserFolder } from "../helpers/userFolder.ts";

import authConfig from "../config.ts";
import { getSessionId } from "../helpers/oauth.ts";

interface State {
  sessionId: string;
  data: any;
}

export async function handler(
  req: Request,
  ctx: FreshContext<State>,
) {
  const { pathname } = new URL(req.url);
  const fullUrl = req.url.replace(pathname, "");
  let folder = "export";

  if (authConfig.oauth.use == true) {
    const kv = await Deno.openKv("./data/kv");
    ctx.state.sessionId = await getSessionId(req) as string;
    if (ctx.state.sessionId) {
      const details = await kv.get([ctx.state.sessionId]);
      ctx.state.data = { ...details.value as any };
      const normalizedUid = resolveUserFolder(ctx.state.data?.uid);
      ctx.state.data = { ...ctx.state.data, uid: normalizedUid };
      folder = normalizedUid;
    } else if (!pathname.startsWith("/api/oauth")) {
      return Response.redirect(fullUrl + "/api/oauth/signin");
    }
  }

  folder = resolveUserFolder(folder);

  if (
    req.method == "GET" && pathname !== "/upload" && !pathname.includes(".") &&
    !await fileExists(`./data/${folder}/profile.csv`)
  ) {
    return Response.redirect(fullUrl + "/upload");
  }

  const unsafePath = (value: string) => {
    return value.includes("..") || value.includes("/") || value.includes("\\");
  };

  if (pathname == "/") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/profile",
      },
    });
  }

  if (pathname == "/media/avatar") {
    try {
      const file = await Deno.open(`./data/${folder}/profile.jpg`, {
        read: true,
      });
      return new Response(file.readable);
    } catch (error) {
      console.error(error);
      return new Response("404 Not Found", { status: 404 });
    }
  }

  if (pathname.startsWith("/media/")) {
    const id = decodeURIComponent(pathname.replaceAll("/media/", ""));
    if (unsafePath(id)) {
      return new Response("400 Bad Request", { status: 400 });
    }
    try {
      const file = await Deno.open(`./data/${folder}/media/${id}`, {
        read: true,
      });
      return new Response(file.readable);
    } catch (error) {
      console.error(error);
      return new Response("404 Not Found", { status: 404 });
    }
  }

  if (pathname.startsWith("/clubs/")) {
    const id = decodeURIComponent(pathname.replaceAll("/clubs/", ""));
    if (unsafePath(id)) {
      return new Response("400 Bad Request", { status: 400 });
    }
    try {
      const file = await Deno.open(`./data/${folder}/clubs/${id}`, {
        read: true,
      });
      return new Response(file.readable);
    } catch (error) {
      console.error(error);
      return new Response("404 Not Found", { status: 404 });
    }
  }

  if (pathname.startsWith("/activity-images/")) {
    const id = decodeURIComponent(pathname.replaceAll("/activity-images/", ""));
    if (unsafePath(id)) {
      return new Response("400 Bad Request", { status: 400 });
    }

    try {
      const file = await Deno.open(`./data/${folder}/activity-images/${id}`, {
        read: true,
      });
      return new Response(file.readable, {
        headers: {
          "content-type": "image/svg+xml",
        },
      });
    } catch (error) {
      console.error(error);
      return new Response("404 Not Found", { status: 404 });
    }
  }

  if (pathname.startsWith("/route-images/")) {
    const id = decodeURIComponent(pathname.replaceAll("/route-images/", ""));
    if (unsafePath(id)) {
      return new Response("400 Bad Request", { status: 400 });
    }

    try {
      const file = await Deno.open(`./data/${folder}/route-images/${id}`, {
        read: true,
      });
      return new Response(file.readable, {
        headers: {
          "content-type": "image/svg+xml",
        },
      });
    } catch (error) {
      console.error(error);
      return new Response("404 Not Found", { status: 404 });
    }
  }

  return await ctx.next();
}
