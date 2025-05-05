import 'dotenv/config';
import { Router } from 'express';
import { randomBytes } from 'crypto';
import { type Response } from 'express-serve-static-core';
import jwt from 'jsonwebtoken';
import { requireEnvAs } from './lib/requireEnvAs.utils.js';


const supabaseJWTSecret = isDev() ? requireEnvAs('string', 'SUPABASE_JWT_SECRET', 'dev_jwt_secret') : '';
const supabaseMockUserId = isDev() ? requireEnvAs('string', 'SUPABASE_MOCK_USER_ID', 'dev_mock_user_id') : '';
const supabaseMockUserEmail = isDev() ? requireEnvAs('string', 'SUPABASE_MOCK_USER_EMAIL', 'dev_mock_user_email') : '';

const aonyxengineSecretAlgorithm = 'aes-256-gcm';
const aonyxEngineSecretKey = requireEnvAs('string', 'AONYXENGINE_SECRET_KEY');

const PROVIDER_MAP = {
    twitch: {
        code_endpoint: requireEnvAs('string', 'TWITCH_CODE_ENDPOINT', 'https://id.twitch.tv/oauth2/authorize'),
        token_endpoint: requireEnvAs('string', 'TWITCH_TOKEN_ENDPOINT', 'https://id.twitch.tv/oauth2/token'),
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
    },
    discord: {
        code_endpoint: requireEnvAs('string', 'DISCORD_CODE_ENDPOINT', 'https://discord.com/api/oauth2/authorize'),
        token_endpoint: requireEnvAs('string', 'DISCORD_TOKEN_ENDPOINT', 'https://discord.com/api/oauth2/token'),
        client_id: requireEnvAs('string', 'DISCORD_CLIENT_ID'),
        client_secret: requireEnvAs('string', 'DISCORD_CLIENT_SECRET'),
        redirect_uri: requireEnvAs('string', 'DISCORD_REDIRECT_URL'),
        scopes: [],
    }
} as Record<string, {
    code_endpoint: string,
    token_endpoint: string,
    client_id: string,
    client_secret: string,
    redirect_uri: string,
    scopes: string[],
}>;


//MARK: UTILS
function redirectHTML(message: string, timeoutInSeconds: number, redirect: string = "/") {
    message = message
    return `
    <!DOCTYPE html>
    <html>
        <meta charset="utf-8"
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Redirecting...</title>
    </head>
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

function createRedirectResponseFunction(res: Response, endpoint: string, public_message: string, options?: { code?: number, redirect?: string, timeout_in_seconds?: number, logType?: 'log' | 'info' | 'warn' | 'error' }) {
    return (reason: string, ...args: any[]) => {
        console[options?.logType ?? 'log'](`[${new Date().toISOString()}] ${endpoint} ${reason}`, ...args);
        return res.status(options?.code ?? 200).send(redirectHTML(public_message, options?.timeout_in_seconds ?? 5, options?.redirect));
    };
}


//MARK: DATABASE
const authRouter = Router();


//MARK: CALLBACK
authRouter.get('/auth/v1/callback', async (req, res): Promise<any> => {
    const success = createRedirectResponseFunction(res, '/auth/v1/twitch/token', 'authentication successful!');
    const fail = createRedirectResponseFunction(res, '/auth/v1/callback', 'authentication failed', { code: 400, logType: 'error' });

    const { code, scope, error, error_description, state } = req.query;

    if (error || !code) return fail('code-error', { error, error_description });

    const { data: states_data, error: states_error } = await supabase.from('oauth_states').select('*').eq('state', state).gt('expires_at', new Date().toISOString()).single();

    if (states_error) return fail('sb-states-error', states_error);

    const { user_id, provider, purpose } = states_data;
    const provider_data = PROVIDER_MAP[provider as string];

    if (!provider_data) return fail('provider-error', provider);

    const { data: token_req_data, error: token_req_error } = await safelyRunAsync(() => fetch(
        provider_data.token_endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: provider_data.client_id,
            client_secret: provider_data.client_secret,
            code: code.toString(),
            grant_type: 'authorization_code',
            redirect_uri: provider_data.redirect_uri
        }).toString()
    }
    ).then(response => response.json()));

    if (token_req_error) return fail('token-req-error', token_req_error);
    if (!token_req_data.refresh_token) return fail('token-req-error', token_req_data);

    const { refresh_token, expires_in, scope: token_scope } = token_req_data;

    if (!arrayIsEqual(scope.toString().split(' ') ?? [], token_scope)) return fail('mismatch-scope', scope.toString().split(' '), token_scope);

    const { error: token_error } = await supabase.from('oauth_tokens').upsert(
        {
            user_id,
            provider,
            token: encryptToken(refresh_token, aonyxengineSecretAlgorithm, aonyxEngineSecretKey),
            token_type: 'refresh_token',
            purpose,
            expires_at: new Date(Date.now() + (expires_in * 1000)).toISOString(),
            metadata: { scope }
        }
        , { onConflict: 'user_id, purpose' })

    if (token_error) return fail('sb-token-error', token_error);

    return success(`login by ${user_id}`);
});


//MARK: DISCORD
authRouter.get('/auth/v1/discord/login', async (req, res) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
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
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'twitch',

    })

    if (error) {
        res.status(500).send(redirectHTML("there was an error getting your request", 10));
        return;
    }

    if (data.url)
        res.redirect(data.url);
});

authRouter.get('/auth/v1/twitch/token', async (req, res): Promise<any> => {
    const fail = createRedirectResponseFunction(res, '/auth/v1/twitch/token', 'request failed', { code: 400, logType: 'error' });

    let provided_token = req.header["Authorization"];

    if (isDev() && (!provided_token || provided_token === "")) {
        console.warn(`[${new Date().toISOString()}] Token not provided. DEVELOPMENT MODE using MOCK USER`);
        const { data: mock_token, error: mock_token_error } = safelyRun(() => jwt.sign({
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
        }, supabaseJWTSecret, { algorithm: 'HS256' }));
        if (mock_token_error) {
            console.error(`[${new Date().toISOString()}] /auth/v1/twitch/token DEVELOPMENT MODE`, mock_token_error);
        } else {
            provided_token = mock_token;
        }
    }

    const { data: user_data, error: sb_user_error } = await supabase.auth.getUser(provided_token);
    const { user } = user_data;
    const twitch_identity = user?.identities?.find(identity => identity.provider === 'twitch');

    if (!user || sb_user_error || !twitch_identity) {
        console.log('anon redirected to login', sb_user_error);
        return res.redirect('/auth/v1/twitch/login');
    }

    console.log('user identities', user.identities);

    const timeout_in_minutes = 5;
    const force_verify = req.query['force_verify']?.toString() ?? 'false';
    const state = randomBytes(16).toString('hex')

    const { code_endpoint, client_id, redirect_uri, scopes } = PROVIDER_MAP['twitch'];

    const search_params = new URLSearchParams({
        client_id,
        force_verify,
        redirect_uri,
        response_type: 'code',
        scope: scopes.join(' '),
        state,
    }).toString();

    const code_request_url = code_endpoint + '?' + search_params;

    const { error } = await supabase.from('oauth_states').insert([{
        user_id: user.id,
        state: state,
        provider: 'twitch',
        expires_at: new Date(Date.now() + (1000 * 60 * timeout_in_minutes)).toISOString(),
        purpose: 'chatbot'
    }]);

    if (error) return fail('sb-code-error', error);

    return res.redirect(code_request_url);
});


//
export { authRouter };

