import WebSocket from "ws";


const twitch_event_wss = process.env.TWITCH_EVENT_WSS


const twitchWS = new WebSocket(twitch_event_wss);


twitchWS.on('open', () => {
    console.log(`[${Date.now()}] twitchWS: connected`);
});


twitchWS.on('error', (err) => {
    console.error(`[${Date.now()}] twitchWS: ${err}`);
});


twitchWS.on('close', () => {
    console.log(`[${Date.now()}] twitchWS: disconnected`);
});


twitchWS.on('message', (rawData) => {
    const data = JSON.parse(rawData.toString());
    console.log(`[${Date.now()}] twitchWS: ${JSON.stringify(data, null, 2)}`);
});


function Cleanup() {
    if (twitchWS.readyState === twitchWS.OPEN) 
        twitchWS.close();
}

/*
process.on('SIGINT', Cleanup);
process.on('SIGQUIT', Cleanup);
process.on('SIGTERM', Cleanup);
*/
