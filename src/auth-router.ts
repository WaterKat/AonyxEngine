import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import 'dotenv/config';


const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'private' }
})

const twitch_client_id = process.env.TWITCH_CLIENT_ID;
const twitch_auth_code_url = process.env.TWITCH_AUTH_CODE_URL;
const twitch_auth_redirect_uri = process.env.TWITCH_AUTH_REDIRECT_URI;
const twitchScopes = ['user:read:chat'];


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


//MARK: DATABASE
const authRouter = Router();


//MARK: CALLBACK
authRouter.get('/auth/v1/callback', async (req, res) => {
    const state = req.query.state;
    try {
        const { data, error } = await supabase.from('oauth_states').select('*').eq('state', state).gt('expires_at', new Date().toISOString()).single();

        if (error || !data) {
            res.status(400).send(redirectHTML('authentication failed', 10));
            console.error(`[${Date.now().toString()}] /auth/v1/callback `, error);
            return;
        }

        //TODO setup oauth token request

        res.status(200).send(redirectHTML('authentication successful', 5));
    } catch (e) {
        console.error(`[${Date.now().toString()}] /auth/v1/callback`, e);
        res.status(500).send(redirectHTML('there was a problem with your authentication', 10));
    }
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

authRouter.get('/auth/v1/twitch/token', async (req, res) => {
    const code_request_url = new URL(twitch_auth_code_url);
    code_request_url.searchParams.append('client_id', twitch_client_id);

    if (req.query['force_verify'] === 'true')
        code_request_url.searchParams.append('force_verify', 'true');

    code_request_url.searchParams.append('redirect_uri', twitch_auth_redirect_uri);
    code_request_url.searchParams.append('response_type', 'code');
    code_request_url.searchParams.append('scope', twitchScopes.join(' '));

    const stateTimeoutInMinutes = 5;
    const generatedState = randomBytes(16).toString('hex')
    code_request_url.searchParams.append('state', generatedState);

    try {
        await supabase.from('oauth_states').insert([
            {
                state: generatedState,
                provider: 'twitch',
                expires_at: new Date(Date.now() + (1000 * 60 * stateTimeoutInMinutes)).toISOString(),
                purpose: 'chatbot'
            }
        ]);
        res.redirect(code_request_url.toString());
    } catch (e) {
        console.error(`[${Date.now().toString()}] /auth/v1/twitch/token `, e);
        res.status(500).redirect('/');
    }
});


//
export { authRouter };
