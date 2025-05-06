import WebSocket from "ws";
import { Router } from "express";
import 'dotenv/config';
import { safelyThrowError, type SafelyResult, safelyRunAsync, safelyWrapError } from './lib/safely.utils.js';
import { supabasePublic } from "./lib/supabaseClient.js";

const twitchEventWSS = process.env.TWITCH_EVENT_WSS

const providerMap = {
    twitch: {
        subscription_endpoint: 'https://api.twitch.tv/helix/eventsub/subscriptions'
    }
}

//MARK: AUTH
type TwitchRefreshTokenResponseSuccess = { access_token: string, refresh_token: string, scope: string[], token_type: string }
type TwitchRefreshTokenResponseError = { error: string, status: number, message: string }
type TwitchRefreshTokenResponse = TwitchRefreshTokenResponseSuccess | TwitchRefreshTokenResponseError

async function getTwitchToken(user_id: string): Promise<SafelyResult<TokenData>> {
    const access_token_request = await TokenManager.get(user_id, 'twitch', 'chatbot', 'access_token');

    if (access_token_request.ok === true)
        return access_token_request;

    const refresh_token = await TokenManager.get(user_id, 'twitch', 'chatbot', 'refresh_token');

    if (refresh_token.ok === false) {
        return safelyWrapError(`failed to get refresh token for ${user_id}`, refresh_token);
    }

    const twitch_refresh_request = await safelyRunAsync(() => fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=refresh_token&refresh_token=${refresh_token.data.token}`
    }).then(res => res.json()));

    if (twitch_refresh_request.ok === false)
        return safelyWrapError(`failed use refresh token for ${user_id}`, twitch_refresh_request);

    const twitch_refresh_response: TwitchRefreshTokenResponse = twitch_refresh_request.data;
    if (typeof twitch_refresh_response['error'] !== 'undefined') {
        const error_response = twitch_refresh_response as TwitchRefreshTokenResponseError;
        return {
            ok: false,
            error: new Error(`${error_response.error} ${error_response.status} ${error_response.message}`)
        }
    }

    const success_response = twitch_refresh_response as TwitchRefreshTokenResponseSuccess;
    const access_token: TokenData = { token: success_response.access_token, provider_user_id: refresh_token.data.provider_user_id };

    const set_refresh_token_request = await TokenManager.set(user_id, 'twitch', 'chatbot', 'refresh_token', { token: success_response.refresh_token, provider_user_id: refresh_token.data.provider_user_id });
    if (set_refresh_token_request.ok === false)
        return set_refresh_token_request;

    const set_access_token_request = await TokenManager.set(user_id, 'twitch', 'chatbot', 'access_token', access_token);
    if (set_access_token_request.ok === false)
        return set_access_token_request

    return {
        ok: true,
        data: access_token
    }
}

async function subscribeEventSub(token: string, client_id: string, twitchEventSub: TwitchEventSub) {
    const header = {
        "Authorization": token,
        "Client-Id": client_id,
        "Content-Type": "application/json"
    }
    const body = twitchEventSub;
    const { data, error } = await safelyRunAsync(() => fetch(providerMap.twitch.subscription_endpoint, { method: 'POST', headers: header, body: JSON.stringify(body) }));
    //TODO ADD POST REQUEST FOR SUBSCRIPTION
}

//MARK: WEBSOCKETS
export const twitchWebSocket = new WebSocket(twitchEventWSS);
const twitchSessionData = {
    "id": "",
    "status": "",
    "connected_at": "",
    "keepalive_timeout_seconds": 0,
    "reconnect_url": "",
    "recovery_url": ""
};

twitchWebSocket.on('open', () => {
    console.log(`[${Date.now()}] twitchWS: connected`);
});

twitchWebSocket.on('error', (err) => {
    console.error(`[${Date.now()}] twitchWS: ${err}`);
});

twitchWebSocket.on('close', () => {
    console.log(`[${Date.now()}] twitchWS: disconnected`);
});

twitchWebSocket.on('message', (raw_data) => {
    const data = JSON.parse(raw_data.toString());
    switch (data.metadata.message_type) {
        case 'session_welcome':
            console.log(`[${Date.now()}] twitchWS: session_welcome received`);
            for (const key in twitchSessionData) {
                if (Object.prototype.hasOwnProperty.call(data.payload, key)) {
                    twitchSessionData[key] = data.payload[key];
                }
            }

            //TODO ADD SUBSCRIPTION CALL AFTER WELCOME MESSAGE
            break;
        case 'notification':
            console.log(`[${Date.now()}] twitchWS: notification ${JSON.stringify(data.payload, null, 2)}`)
            break;
        default:
            console.log(`[${Date.now()}] twitchWS: default ${JSON.stringify(data, null, 2)}`);
            break;
    }
});

