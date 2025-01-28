export default {
    oauth: {
        use: Deno.env.get('USE_OPENID') == 'true',
        issuerUrl: Deno.env.get('OPENID_ISSUER_URL') ?? '',
        clientId: Deno.env.get('OPENID_CLIENT_ID') ?? '',
        clientSecret: Deno.env.get('OPENID_CLIENT_SECRET') ?? '',
        callbackUrl: Deno.env.get('OPENID_CALLBACK_URL') ?? '',
        scope: Deno.env.get('OPENID_SCOPE') ?? '',
        buttonText: Deno.env.get('OPENID_LOGIN_BUTTON_TEXT') ?? '',
        autoRegister: Deno.env.get('OPENID_AUTO_REGISTER') == 'true',
        autoLaunch: Deno.env.get('OPENID_AUTO_LAUNCH') == 'true',
    }
}
