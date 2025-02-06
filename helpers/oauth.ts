import { type OAuth2ClientConfig, createHelpers } from "jsr:@deno/kv-oauth";
import authConfig from '../config.ts';

export const oauthConfig: OAuth2ClientConfig = {
    clientId: authConfig.oauth.clientId,
    clientSecret: authConfig.oauth.clientSecret,
    authorizationEndpointUri: "https://auth.hylia.network/application/o/authorize/",
    tokenUri: "https://auth.hylia.network/application/o/token/",
    redirectUri: 'http://localhost:3000/api/oauth/callback',
    defaults: { scope: authConfig.oauth.scope },
};
export const {
    signIn,
    handleCallback,
    getSessionId,
    signOut,
} = createHelpers(oauthConfig);
