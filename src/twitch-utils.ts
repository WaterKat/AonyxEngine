import WebSocket from "ws";
import { Router } from "express";
import 'dotenv/config';

const twitch_event_wss = process.env.TWITCH_EVENT_WSS
const twitch_sub_url = process.env.TWITCH_SUBSCRIPTION_URL;
const twitch_client_id = process.env.TWITCH_CLIENT_ID;
const twitch_auth_code_url = process.env.TWITCH_AUTH_CODE_URL;
const twitch_auth_redirect_uri = process.env.TWITCH_AUTH_REDIRECT_URI;


//MARK: SUBSCRIPTIONS
//TODO subscription function after successful websocket connection

//MARK: WEBSOCKETS
export const twitchWebSocket = new WebSocket(twitch_event_wss);

twitchWebSocket.on('open', () => {
    console.log(`[${Date.now()}] twitchWS: connected`);
});

twitchWebSocket.on('error', (err) => {
    console.error(`[${Date.now()}] twitchWS: ${err}`);
});

twitchWebSocket.on('close', () => {
    console.log(`[${Date.now()}] twitchWS: disconnected`);
});

twitchWebSocket.on('message', (rawData) => {
    const data = JSON.parse(rawData.toString());


    switch (data.metadata.message_type) {
        case 'session_welcome':
            console.log(`[${Date.now()}] twitchWS: session_welcome ${JSON.stringify(data.payload, null, 2)}`)
            break;
        case 'notification':
            console.log(`[${Date.now()}] twitchWS: notification ${JSON.stringify(data.payload, null, 2)}`)
            break;
        default:
            console.log(`[${Date.now()}] twitchWS: default ${JSON.stringify(data, null, 2)}`);
            break;
    }
});

