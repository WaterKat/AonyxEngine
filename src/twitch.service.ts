import WebSocket from "ws";
import 'dotenv/config';
import { safelyThrowError, type SafelyResult, safelyRunAsync, safelyWrapError } from './lib/safely.utils.js';
import { supabasePublic } from "./lib/supabaseClient.js";

import { TokenData, TokenManager } from "./lib/TokenManager.service.js";
import { requireEnvAs } from "./lib/requireEnvAs.utils.js";
import { TwitchEventSub } from "./types/twitch.types.js";

const TWITCH_EVENT_WSS = requireEnvAs('string', 'TWITCH_EVENT_WSS', 'wss://eventsub.wss.twitch.tv/ws');
const TWITCH_CLIENT_ID = requireEnvAs('string', 'TWITCH_CLIENT_ID');

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

async function subscribeEventSub(token: string, client_id: string, twitchEventSub: TwitchEventSub): Promise<SafelyResult<any>> {
    const header = {
        "Authorization": `Bearer ${token}`,
        "Client-Id": client_id,
        "Content-Type": "application/json"
    }
    const body = twitchEventSub;
    const subscription_request = await safelyRunAsync(() =>
        fetch(providerMap.twitch.subscription_endpoint, { method: 'POST', headers: header, body: JSON.stringify(body) })
            .then(response => response.json())
    );
    return subscription_request;
}

async function SubscribeAll(token: string, twitch_user_id: string, websocket_id: string): Promise<SafelyResult<void>> {
    //TODO MARK: TODO SUBSCRIBE
    const message_subscription_request = subscribeEventSub(token, TWITCH_CLIENT_ID, {
        type: "channel.chat.message",
        version: "1",
        condition: {
            broadcaster_user_id: twitch_user_id,
            user_id: twitch_user_id,
        },
        transport: {
            method: "websocket",
            session_id: websocket_id,
        }
    });
    console.log(`[${Date.now()}] twitchWS: message_subscription_request ${JSON.stringify(await message_subscription_request, null, 2)}`);
    return message_subscription_request;
}

//MARK: WEBSOCKETS
export const twitchWebSocket = new WebSocket(TWITCH_EVENT_WSS);
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

            const incoming_session_data = data.payload.session;
            for (const key in incoming_session_data) {
                if (Object.prototype.hasOwnProperty.call(twitchSessionData, key)) {
                    twitchSessionData[key] = incoming_session_data[key];
                }
            }

            const subscriptionsPromise = safelyRunAsync(async () => {
                const { data: chatbots, error: chatbots_error } = await supabasePublic.from('twitch_chatbots').select('*');
                if (chatbots_error)
                    return safelyThrowError(chatbots_error);

                const token_promises = chatbots.map((chatbot) => {
                    //console.log(`[${Date.now()}] twitchWS: subscribing ${chatbot.user_id} ${chatbot.id}}`);
                    return getTwitchToken(chatbot.user_id);
                })

                const subscription_promises = token_promises.map(async token_promise => {
                    const token_result = await token_promise;

                    if (token_result.ok === false) {
                        return token_result;
                    }

                    return SubscribeAll(token_result.data.token, token_result.data.provider_user_id, twitchSessionData.id);
                });

                const sub_response = await Promise.all(subscription_promises);

                (async () => {
                    for (const response of sub_response) {
                        if (response.ok === false) {
                            console.error(`[${Date.now()}] twitchWS: subscription error`, response.error.message);
                        }
                    }
                })();

            }).then(() => {
                console.log(`[${Date.now()}] twitchWS: subscriptions sent`);
            })


            //TODO ADD SUBSCRIPTION CALL AFTER WELCOME MESSAGE
            break;
        case 'session_keepalive':
            console.log(`[${Date.now()}] twitchWS: session_keepalive received`);
            break;
        case 'notification':
            console.log(`[${Date.now()}] twitchWS: notification ${JSON.stringify(data.payload, null, 2)}`)
            break;
        default:
            console.log(`[${Date.now()}] twitchWS: default ${JSON.stringify(data, null, 2)}`);
            break;
    }
});

