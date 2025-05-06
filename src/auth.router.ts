import 'dotenv/config';
import { Router } from 'express';
import { type Response } from 'express-serve-static-core';
import jwt from 'jsonwebtoken';
import { arrayIsEqual, isDev } from './lib/utils.js';
import { SafelyResult, safelyRun, safelyRunAsync, safelyWrapError } from './lib/safely.utils.js';
import { requireEnvAs } from './lib/requireEnvAs.utils.js';
import { supabasePrivate } from './lib/supabaseClient.js';
import { TwitchAuthTokenResponse, TwitchAuthTokenResponseSuccess as AuthTokenResponseSuccess } from './types/twitch.types.js';
import { StateManager } from './lib/StateManager.service.js';
import { TokenData, TokenManager } from './lib/TokenManager.service.js';


//MARK: MOCK USER
const supabaseJWTSecret = isDev() ? requireEnvAs('string', 'SUPABASE_JWT_SECRET', 'dev_jwt_secret') : '';
const supabaseMockUserId = isDev() ? requireEnvAs('string', 'SUPABASE_MOCK_USER_ID', 'dev_mock_user_id') : '';
const supabaseMockUserEmail = isDev() ? requireEnvAs('string', 'SUPABASE_MOCK_USER_EMAIL', 'dev_mock_user_email') : '';
const generateMockUser = () => {
    console.warn('GENERATING MOCK USER, THIS IS JUST FOR DEVELOPMENT PURPOSES');
    return jwt.sign({
        sub: supabaseMockUserId,
        email: supabaseMockUserEmail,
        role: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
        aud: "authenticated",
        app_metadata: {
            provider: "email",
            providers: ["email"],
        },
        user_metadata: {
            full_name: "AonyxEngine"
        }
    }, supabaseJWTSecret, { algorithm: 'HS256' });
}
const MOCK_USER_JWT = isDev() ? generateMockUser() : '';


//MARK: UTILS
function redirectHTML(message: string, timeoutInSeconds: number, redirect: string = "/") {
    message = message
    return `
    <!DOCTYPE html>
    <html>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Redirecting...</title>
    <head>
        <script>setTimeout(() => { window.location.replace("${redirect}") }, 1000 * ${timeoutInSeconds});</script>
    </head>
    <body>
        <div>${message}</div>
        <br>
        <p>You will be redirected in ${timeoutInSeconds} seconds...</p>
    </body>
    </html>
    `;
}

function supabaseToSafelyResult<T>(result: { data: T, error: any }): SafelyResult<T> {
    if (result.error)
        return { ok: false, error: result.error };
    return {
        ok: true,
        data: result.data
    }
}

function parseCodeURL(query: any): SafelyResult<{ code: string, state: string, scopes: string }> {
    if (!query.code || !query.state) {
        if (query.error)
            return { ok: false, error: new Error([query.error, query.error_description].join(' ')) };
        return { ok: false, error: new Error('code / state not found') };
    }

    return {
        ok: true,
        data: { code: query.code, state: query.state, scopes: query.scope }
    }
}

function createRedirectResponseFunction(res: Response, endpoint: string, public_message: string, options?: { code?: number, redirect?: string, timeout_in_seconds?: number, logType?: 'log' | 'info' | 'warn' | 'error' }) {
    return (reason: string, ...args: any[]) => {
        console[options?.logType ?? 'log'](`[${new Date().toISOString()}] ${endpoint} ${reason}`, ...args);
        return res.status(options?.code ?? 200).send(redirectHTML(public_message, options?.timeout_in_seconds ?? 5, options?.redirect));
    };
}


//MARK: SETUP

const PROVIDER_MAP = {
    twitch: {
        code_endpoint: requireEnvAs('string', 'TWITCH_CODE_ENDPOINT', 'https://id.twitch.tv/oauth2/authorize'),
        token_endpoint: requireEnvAs('string', 'TWITCH_TOKEN_ENDPOINT', 'https://id.twitch.tv/oauth2/token'),
        validate_endpoint: requireEnvAs('string', 'TWITCH_VERIFY_ENDPOINT', 'https://id.twitch.tv/oauth2/validate'),
        client_id: requireEnvAs('string', 'TWITCH_CLIENT_ID'),
        client_secret: requireEnvAs('string', 'TWITCH_CLIENT_SECRET'),
        redirect_uri: requireEnvAs('string', 'TWITCH_REDIRECT_URL'),
        scopes: [
            'user:read:chat',
            'moderator:read:followers',
            'channel:read:subscriptions',
            'bits:read',
            'channel:read:polls',
            'channel:read:charity',
            'channel:read:goals',
            'channel:read:hype_train',
            'channel:read:redemptions'
        ],
        verifyToken: (token: string) => safelyRunAsync(() => fetch(PROVIDER_MAP.twitch.validate_endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).then(res => res.json()).then(data => ({ token: token, provider_user_id: data.user_id }))),
    },
    discord: {
        code_endpoint: requireEnvAs('string', 'DISCORD_CODE_ENDPOINT', 'https://discord.com/api/oauth2/authorize'),
        token_endpoint: requireEnvAs('string', 'DISCORD_TOKEN_ENDPOINT', 'https://discord.com/api/oauth2/token'),
        validate_endpoint: requireEnvAs('string', 'DISCORD_VERIFY_ENDPOINT', 'https://discord.com/api/users/@me'),
        client_id: requireEnvAs('string', 'DISCORD_CLIENT_ID'),
        client_secret: requireEnvAs('string', 'DISCORD_CLIENT_SECRET'),
        redirect_uri: requireEnvAs('string', 'DISCORD_REDIRECT_URL'),
        scopes: [],
        verifyToken: (token: string) => safelyRunAsync(() => fetch(PROVIDER_MAP.discord.validate_endpoint, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).then(res => res.json()).then(data => ({ token: token, provider_user_id: data.id }))),
    }
} as Record<string, {
    code_endpoint: string,
    token_endpoint: string,
    validate_endpoint: string,
    client_id: string,
    client_secret: string,
    redirect_uri: string,
    scopes: string[],
    verifyToken: (token: string) => Promise<SafelyResult<TokenData>>
}>;


//MARK: ROUTER
const authRouter = Router();


//MARK: CALLBACK
authRouter.get('/auth/v1/callback', async (req, res): Promise<any> => {
    const success = createRedirectResponseFunction(res, '/auth/v1/callback', 'authentication successful!');
    const fail = createRedirectResponseFunction(res, '/auth/v1/callback', 'authentication failed', { code: 400, logType: 'error' });

    const user_jwt: string = req.header["Authorization"] ? req.header["Authorization"] : isDev() ? MOCK_USER_JWT : '';

    const user_data = await supabasePrivate.auth.getUser(user_jwt).then(supabaseToSafelyResult);
    if (user_data.ok === false) return fail('cb-user-error', user_data.error);

    const code_data = parseCodeURL(req.query);
    if (code_data.ok === false) return fail('cb-code-error', code_data.error);

    const state_data = await StateManager.use(user_data.data.user.id, code_data.data.state);
    if (state_data.ok === false) return fail('cb-state-error', state_data.error);

    const provider_data = PROVIDER_MAP[state_data.data.provider];
    if (!provider_data) return fail('cb-provider-error', state_data.data.provider);

    const token_request_body = {
        client_id: provider_data.client_id,
        client_secret: provider_data.client_secret,
        code: code_data.data.code,
        grant_type: 'authorization_code',
        redirect_uri: provider_data.redirect_uri
    };

    const token_req: SafelyResult<TwitchAuthTokenResponse> = await safelyRunAsync(() => fetch(
        provider_data.token_endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(token_request_body).toString()
    }).then(response => response.json()));

    if (token_req.ok === false) return fail('cb-token-req1-error', token_req.error);
    if ('error' in token_req.data) return fail('cb-token-req2-error', JSON.stringify(token_req.data));

    const { access_token, refresh_token, scope } = token_req.data as AuthTokenResponseSuccess;

    if (!arrayIsEqual(code_data.data.scopes.toString().split(' ') ?? [], scope)) return fail('mismatch-scope', code_data.data.scopes.toString().split(' '), scope);

    const verification_req = await provider_data.verifyToken(access_token);
    if (verification_req.ok === false) return fail('cb-verify-token-error', verification_req.error);

    const { provider_user_id } = verification_req.data;

    const set_refresh_token = await TokenManager.set(user_data.data.user.id, state_data.data.provider, state_data.data.purpose, 'refresh_token', {
        token: token_req.data.refresh_token,
        provider_user_id: provider_user_id
    });
    if (set_refresh_token.ok === false) return fail('cb-set-refresh-token-error', set_refresh_token.error);

    const set_access_token = await TokenManager.set(user_data.data.user.id, state_data.data.provider, state_data.data.purpose, 'access_token', {
        token: token_req.data.access_token,
        provider_user_id: provider_user_id
    });
    if (set_access_token.ok === false) return fail('cb-set-access-token-error', set_access_token.error);

    return success(`login by ${user_data.data.user.id}`);
});


//MARK: DISCORD
authRouter.get('/auth/v1/discord/login', async (req, res) => {
    const { data, error } = await supabasePrivate.auth.signInWithOAuth({
        provider: 'discord',

    })

    if (error) {
        res.status(500).send(redirectHTML('there was an error getting your request', 10));
        return;
    }

    if (data.url)
        res.redirect(data.url);
});


//MARK: TWITCH
authRouter.get('/auth/v1/twitch/login', async (req, res) => {
    const sign_in = await supabasePrivate.auth.signInWithOAuth({
        provider: 'twitch',
    }).then(supabaseToSafelyResult)

    if (sign_in.ok === false) {
        res.status(500).send(redirectHTML("there was an error getting your request", 10));
        return;
    }

    res.redirect(sign_in.data.url);
});

authRouter.get('/auth/v1/twitch/token', async (req, res): Promise<any> => {
    const fail = createRedirectResponseFunction(res, '/auth/v1/twitch/token', 'request failed', { code: 400, logType: 'error' });

    const user_jwt: string = req.header["Authorization"] ? req.header["Authorization"] : isDev() ? MOCK_USER_JWT : '';

    const user_data = await supabasePrivate.auth.getUser(user_jwt).then(supabaseToSafelyResult);
    if (user_data.ok === false) return fail('sb-user-error', user_data.error);

    const state_data = await StateManager.create(user_data.data.user.id, 'twitch', 'chatbot');
    if (state_data.ok === false) return fail('sb-state-error', state_data.error);

    const force_verify = req.query['force_verify']?.toString() ?? 'false';

    const { code_endpoint, client_id, redirect_uri, scopes } = PROVIDER_MAP['twitch'];

    const search_params = {
        client_id,
        force_verify,
        redirect_uri,
        response_type: 'code',
        scope: scopes.join(' '),
        state: state_data.data.state,
    };

    const code_request_url = code_endpoint + '?' + new URLSearchParams(search_params).toString();

    return res.redirect(code_request_url);
});


export { authRouter };
