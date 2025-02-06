import type { Plugin } from "$fresh/server.ts";
import { signIn, signOut, handleCallback } from "../helpers/oauth.ts";
import { parseJwt } from "../helpers/parseJwt.ts";

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
    
  ],
} as Plugin;