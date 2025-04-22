import WebSocket from "ws";
import { Router } from "express";
import 'dotenv/config';

const twitch_event_wss = process.env.TWITCH_EVENT_WSS

const provider_map = {
    twitch: {
        subscription_endpoint: 'https://api.twitch.tv/helix/eventsub/subscriptions'
    }
}

//MARK: SUBSCRIPTIONS
//TODO subscription function after successful websocket connection
function subscribeChatbots(token: string, client_id: string) {
    const header = {
        "Authorization": token,
        "Client-Id": client_id,
        "Content-Type": "application/json"
    }
    const body = {
        "type": "channel.follow",
        "version": "2",
        "condition": {
            "broadcaster_user_id": "1234",
            "moderator_user_id": "1234"
        },
        "transport": {
            "method": "webhook",
            "callback": "https://example.com/callback",
            "secret": "s3cre77890ab"
        }
    }
    //TODO ADD POST REQUEST FOR SUBSCRIPTION
}

//MARK: WEBSOCKETS
export const twitchWebSocket = new WebSocket(twitch_event_wss);
const twitch_session_data = {
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
            for (const key in twitch_session_data) {
                if (Object.prototype.hasOwnProperty.call(data.payload, key)) {
                    twitch_session_data[key] = data.payload[key];
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

