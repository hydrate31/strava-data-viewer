import { FreshContext } from "$fresh/server.ts";
import { type OAuth2ClientConfig, createHelpers } from "jsr:@deno/kv-oauth";
import authConfig from '../config.ts';


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

export async function handler(
    req: Request,
    ctx: FreshContext<State>,
) {
    const kv = await Deno.openKv('./data/kv');
    ctx.state.sessionId = await getSessionId(req);

    if (ctx.state.sessionId) {
        const details = await kv.get([ctx.state.sessionId]);
        ctx.state.data = { ...details.value as any }
    }
    const { pathname } = new URL(req.url);
    switch (pathname) {
        case "/api/oauth/signin":
            return await signIn(req);
        case "/api/oauth/callback": {
            const { response, tokens, sessionId } = await handleCallback(req);
            const payload: Token = parseJwt(tokens.accessToken)
            await kv.set([sessionId], payload)
            return response;
        }
        case "/api/oauth/signout":
            return await signOut(req);
        case "/protected-route":
            return await getSessionId(req) === undefined
                ? new Response("Unauthorized", { status: 401 })
                : new Response("You are allowed");
                
        default:
            return await ctx.next();
    }
}