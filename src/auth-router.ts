import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import 'dotenv/config';
import { Response } from 'express-serve-static-core';


const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
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
} satisfies Record<string, {
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

function createFailResponseFunction(res: Response, endpoint: string, public_message: string, timeout_in_seconds: number, code: number = 400) {
    const fail = (reason: string, ...args: any[]) => {
        console.error(`[${new Date().toISOString()}] ${endpoint} ${reason}`, ...args);
        return res.status(code).send(redirectHTML(public_message, timeout_in_seconds));
    };
    return fail;
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

async function fetchJSON<T = any>(input: string | URL | globalThis.Request, init?: RequestInit): Promise<{ data: T, error: Error }> {
    try {
        const response = await fetch(input, init);
        const json = await response.json();
        return { data: json as T, error: undefined };
    } catch (e) {
        return { data: undefined, error: e };
    }
}




//MARK: DATABASE
const authRouter = Router();


//MARK: CALLBACK
authRouter.get('/auth/v1/callback', async (req, res): Promise<any> => {
    const fail = (reason: string, ...args: any[]) => {
        console.error(`[${new Date().toISOString()}] /auth/v1/callback ${reason}`, ...args);
        return res.status(400).send(redirectHTML('authentication failed', 10));
    };

    const { code, scope, error, error_description, state } = req.query;

    if (error || !code) return fail('code-error', { error, error_description });

    const { data: states_data, error: states_error } = await supabase.from('oauth_states').select('*').eq('state', state).gt('expires_at', new Date().toISOString()).single();

    if (states_error) return fail('sb-states-error', states_error);

    const { user_id, provider, purpose } = states_data;

    if (!provider_map[provider]) return fail('provider-error', provider);

    const { data: token_req_data, error: token_req_error } = await fetchJSON(provider_map[provider].api_endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: provider_map[provider].client_id,
            client_secret: provider_map[provider].client_secret,
            code: code.toString(),
            grant_type: 'authorization_code',
            redirect_uri: provider_map[provider].redirect_uri
        }).toString()
    });

    if (token_req_error) return fail('token-req-error', token_req_error);
    if (!token_req_data.refresh_token) return fail('token-req-error', token_req_data);

    const { refresh_token, expires_in, scope: token_scope } = token_req_data;

    if (!arrayIsEqual(scope.toString().split(' ') ?? [], token_scope)) return fail('mismatch-scope', scope.toString().split(' '), token_scope);

    const { error: token_error } = await supabase.from('oauth_tokens').insert([
        {
            user_id,
            provider,
            token: refresh_token,
            token_type: 'refresh_token',
            purpose,
            expires_at: new Date(Date.now() + (expires_in * 1000)).toISOString(),
            metadata: { scope }
        }
    ]);

    if (token_error) return fail('sb-token-error');

    res.status(200).send(redirectHTML('authentication successful!', 5));
    console.log(`[${Date.now().toString()}] /auth/v1/callback successful login by ${user_id}`);
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
    const fail = createFailResponseFunction(res, '/auth/v1/twitch/token', 'request failed', 10);

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
