import WebSocket from "ws";
import { Router } from "express";
import 'dotenv/config';
import { safelyRunAsync } from "./utils.js";

const twitchEventWSS = process.env.TWITCH_EVENT_WSS

const providerMap = {
    twitch: {
        subscription_endpoint: 'https://api.twitch.tv/helix/eventsub/subscriptions'
    }
}

//MARK: SUBSCRIPTIONS
//TODO subscription function after successful websocket connection
type TwitchTransportWebSocket = {
    method: "websocket",
    session_id: string,
    connected_at?: string,
    disconnected_at?: string
}
type TwitchTransportWebHook = {
    method: "webhook",
    callback: string,
    secret: string,
}
type TwitchTransport = TwitchTransportWebHook | TwitchTransportWebSocket;

/** required scopes 'user:read:chat' */
type TwitchEventSubChannelChatMessage = {
    type: "channel.chat.message",
    version: "1",
    condition: {
        broadcaster_user_id: string,
        user_id: string,
    }
    transport: TwitchTransport
}

/** required scopes 'moderator:read:followers' */
type TwitchEventSubChannelFollow = {
    type: "channel.follow",
    version: "2",
    condition: {
        broadcaster_user_id: string,
        moderator_user_id: string,
    }
    transport: TwitchTransport
}

/** required scopes 'channel:read:subscriptions' */
type TwitchEventSubChannelSubscribe = {
    type: "channel.subscribe",
    version: "1",
    condition: {
        broadcaster_user_id: string,
    }
    transport: TwitchTransport
}

/** required scopes 'bits:read' */
type TwitchEventSubChannelCheer = {
    type: "channel.cheer",
    version: "1",
    condition: {
        broadcaster_user_id: string,
    }
    transport: TwitchTransport
}

/** required scopes NONE */
type TwitchEventSubChannelRaid = {
    type: "channel.raid",
    version: "1",
    condition: {
        to_broadcaster_user_id: string,
    }
    transport: TwitchTransport
}

/** required scopes 'channel:read:polls' */
type TwitchEventSubChannelPollBegin = {
    type: "channel.poll.begin",
    version: "1",
    condition: {
        broadcaster_user_id: string,
    }
    transport: TwitchTransport
}

/** required scopes 'channel:read:polls' */
type TwitchEventSubChannelPollEnd = {
    type: "channel.poll.end",
    version: "1",
    condition: {
        broadcaster_user_id: string,
    }
    transport: TwitchTransport
}

/** required scopes 'channel:read:redemptions' */
type TwitchEventSubChannelAutomaticRedemption = {
    type: "channel.channel_points_automatic_reward_redemption.add",
    version: "1",
    condition: {
        broadcaster_user_id: string,
    }
    transport: TwitchTransport
}

/** required scopes 'channel:read:redemptions' */
type TwitchEventSubChannelCustomRedemption = {
    type: "channel.channel_points_custom_reward_redemption.add",
    version: "1",
    condition: {
        broadcaster_user_id: string,
        reward_id?: string,
    }
    transport: TwitchTransport
}

type TwitchEventSub =
    | TwitchEventSubChannelChatMessage
    | TwitchEventSubChannelFollow
    | TwitchEventSubChannelSubscribe
    | TwitchEventSubChannelCheer
    | TwitchEventSubChannelRaid
    | TwitchEventSubChannelPollBegin
    | TwitchEventSubChannelPollEnd
    | TwitchEventSubChannelAutomaticRedemption
    | TwitchEventSubChannelCustomRedemption;

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

