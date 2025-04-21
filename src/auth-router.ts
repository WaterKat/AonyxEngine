import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import 'dotenv/config';
import { type Response } from 'express-serve-static-core';
import jwt from 'jsonwebtoken';


const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase_jwt_secret = process.env.SUPABASE_JWT_SECRET;

if (supabase_jwt_secret === "" || !supabase_jwt_secret) {
    console.error('Please set the SUPABASE_JWT_SECRET environmental variable');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'private' }
})

const provider_map = {
    twitch: {
        code_endpoint: process.env.TWITCH_CODE_ENDPOINT ?? 'https://id.twitch.tv/oauth2/authorize',
        token_endpoint: process.env.TWITCH_TOKEN_ENDPOINT ?? 'https://id.twitch.tv/oauth2/token',
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        redirect_uri: process.env.TWITCH_REDIRECT_URL,
        scopes: ['user:read:chat'],
    },
    discord: {
        code_endpoint: process.env.DISCORD_CODE_ENDPOINT ?? 'https://discord.com/api/oauth2/authorize',
        token_endpoint: process.env.DISCORD_TOKEN_ENDPOINT ?? 'https://discord.com/api/oauth2/token',
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        redirect_uri: process.env.DISCORD_REDIRECT_URL,
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

function arrayIsEqual(a: any[], b: any[]): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    const c = Array.from(a).sort();
    const d = Array.from(b).sort();

    for (let i = 0; i < c.length; i++) {
        if (c[i] !== d[i]) return false;
    }

    return true;
}

type SafelyResultSuccess<T> = { data: T, error: undefined };
type SafelyResultFailure = { data: undefined, error: Error; }
type SafelyResult<T> = SafelyResultSuccess<T> | SafelyResultFailure;

function safelyRun<K extends (...args: any[]) => any>(func: K, ...args: Parameters<K>): SafelyResult<ReturnType<K>> {
    try {
        return { data: func(...args), error: undefined };
    } catch (e) {
        return { data: undefined, error: e instanceof Error ? e : new Error(String(e)) };
    }
};

async function safelyRunAsync<K extends (...args: any[]) => Promise<any>>(func: K, ...args: Parameters<K>): Promise<SafelyResult<Awaited<ReturnType<K>>>> {
    try {
        return { data: await func(...args), error: undefined };
    } catch (e) {
        return { data: undefined, error: e instanceof Error ? e : new Error(String(e)) };
    }
};

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
    const provider_data = provider_map[provider as string];

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
            token: refresh_token,
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

    const token = req.header["Authorization"] ?? "";
    //    const { data: user_jwt_data, error: user_jwt_error } = decodeJWT(token, supabase_jwt_secret);
    //region: //TODO
    const { data: { user: user_data }, error: user_error } = await supabase.auth.getUser(token);
    let user = user_data;

    if (process.env.NODE_ENV === 'development' && user_error) {
        console.error(`[${new Date().toISOString()}] /auth/v1/twitch/token`, user_error);
        console.warn(`[${new Date().toISOString()}] DEVELOPMENT MODE using MOCK USER`);
        const token = jwt.sign({

        }, process.env.SUPABASE_JWT_SECRET);
        const { data: { user: mock_user }, error: mock_error } = await supabase.auth.getUser();
        if (mock_error)
            return fail('invalid user and failed mock', user_error, mock_error);
        else
            user = mock_user;
    }
    else
        return fail('invalid user', user_error);

    if (!user || user_error) {
        console.log('anon redirected to login', user_error);
        return res.redirect('/auth/v1/twitch/login');
    }
    //endregion

    const timeout_in_minutes = 5;
    const force_verify = req.query['force_verify']?.toString() ?? 'false';
    const state = randomBytes(16).toString('hex')

    const { code_endpoint, client_id, redirect_uri, scopes } = provider_map['twitch'];

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
        user_id: user_data.id,
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

