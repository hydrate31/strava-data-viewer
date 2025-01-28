import { FreshContext } from "$fresh/server.ts";
import { fileExists } from "../packages/strava.export-data-reader/helpers/fileExists.ts";

interface State {

}

export async function handler(
    req: Request,
    ctx: FreshContext<State>,
) {
    const { pathname } = new URL(req.url);

    const fullUrl = req.url.replace(pathname, "");

    if (req.method == "GET" && pathname !== "/upload" && !pathname.includes(".") && !await fileExists("./data/export/profile.csv")) {
        return Response.redirect(fullUrl + "/upload")
    }

    if (pathname == '/') {
        return new Response(null, {
            status: 302,
            headers: {
                Location: "/profile",
            }
        })
    }

    if (pathname == '/media/avatar')  {
        try {
            const file = await Deno.open(`./data/export/profile.jpg`, { read: true });
            return new Response(file.readable);
        } catch (error) {
            console.error(error)
            return new Response("404 Not Found", { status: 404 });
        }
    }

    if (pathname.startsWith('/media/')) {
        const id = pathname.replaceAll('/media/', '');
        try {
            const file = await Deno.open(`./data/export/media/${id}`, { read: true });
            return new Response(file.readable);
        } catch (error) {
            console.error(error)
            return new Response("404 Not Found", { status: 404 });
        }
    }

    if (pathname.startsWith('/clubs/')) {
        const id = pathname.replaceAll('/clubs/', '');
        try {
            const file = await Deno.open(`./data/export/clubs/${id}`, { read: true });
            return new Response(file.readable);
        } catch (error) {
            console.error(error)
            return new Response("404 Not Found", { status: 404 });
        }
    }

    return await ctx.next();
}