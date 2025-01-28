import { type OAuth2ClientConfig, createHelpers } from "jsr:@deno/kv-oauth";
import authConfig from '../config.ts';
import type { Plugin } from "$fresh/server.ts";

const oauthConfig: OAuth2ClientConfig = {
    clientId: authConfig.oauth.clientId,
    clientSecret: authConfig.oauth.clientSecret,
    authorizationEndpointUri: "https://auth.hylia.network/application/o/authorize/",
    tokenUri: "https://auth.hylia.network/application/o/token/",
    redirectUri: 'http://localhost:3000/api/oauth/callback',
    defaults: { scope: authConfig.oauth.scope },
};
const {
    signIn,
    handleCallback,
    getSessionId,
    signOut,
} = createHelpers(oauthConfig);

interface State {
    data?: {
        uid: string,
        email: string,
        email_verified: boolean,
        name: string,
        given_name: string,
        nickname: string,
        preferred_username: string
    };
    sessionId: string | undefined;
}

function parseJwt(token: string) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

interface Token {
    uid: string,
    email: string,
    email_verified: boolean,
    name: string,
    given_name: string,
    nickname: string,
    preferred_username: string
}


export default {
  name: "kv-oauth",
  routes: [
    {
      path: "/api/oauth/signin",
      async handler(req) {
        return await signIn(req);
      },
    },
    {
      path: "/api/oauth/callback",
      async handler(req) {
        const kv = await Deno.openKv('./data/kv');
        const { response, tokens, sessionId } = await handleCallback(req);
        const payload: Token = parseJwt(tokens.accessToken)
        await kv.set([sessionId], payload)
        return response;
      },
    },
    {
      path: "/api/oauth/signout",
      async handler(req) {
        return await signOut(req);
      },
    },
    {
      path: "/",
      async handler(req, ctx) {
        if (authConfig.oauth.use == false) {
            return await ctx.next();
        }
        const { pathname } = new URL(req.url);
        const fullUrl = req.url.replace(pathname, "");

        if (pathname.startsWith("/api/oauth")) {
            return await ctx.next();;
        }

        const kv = await Deno.openKv('./data/kv');
        ctx.state.sessionId = await getSessionId(req);
        if (ctx.state.sessionId) {
            const details = await kv.get([ctx.state.sessionId]);
            ctx.state.data = { ...details.value as any }
        }

        console.log(ctx.state)

        return await getSessionId(req) === undefined
          ? new Response("Unauthorized", { status: 401 })
          : Response.redirect(fullUrl + "/api/oauth/signin");
      },
    },
  ],
} as Plugin;