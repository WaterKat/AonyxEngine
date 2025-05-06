type TwitchErrorResponse = {
    error: string;
    status: number;
    message: string;
}

export type TwitchAuthTokenResponseSuccess = {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string[];
    token_type: 'bearer';
}

export type TwitchAuthTokenResponse = TwitchAuthTokenResponseSuccess | TwitchErrorResponse;

//MARK: SUBSCRIPTIONS
//TODO subscription function after successful websocket connection
type TwitchTransportWebSocket = {
    method: "websocket";
    session_id: string;
    connected_at?: string;
    disconnected_at?: string;
};
type TwitchTransportWebHook = {
    method: "webhook";
    callback: string;
    secret: string;
};
type TwitchTransport = TwitchTransportWebHook | TwitchTransportWebSocket;
/** required scopes 'user:read:chat' */
type TwitchEventSubChannelChatMessage = {
    type: "channel.chat.message";
    version: "1";
    condition: {
        broadcaster_user_id: string;
        user_id: string;
    };
    transport: TwitchTransport;
};
/** required scopes 'moderator:read:followers' */
type TwitchEventSubChannelFollow = {
    type: "channel.follow";
    version: "2";
    condition: {
        broadcaster_user_id: string;
        moderator_user_id: string;
    };
    transport: TwitchTransport;
};
/** required scopes 'channel:read:subscriptions' */
type TwitchEventSubChannelSubscribe = {
    type: "channel.subscribe";
    version: "1";
    condition: {
        broadcaster_user_id: string;
    };
    transport: TwitchTransport;
};
/** required scopes 'bits:read' */
type TwitchEventSubChannelCheer = {
    type: "channel.cheer";
    version: "1";
    condition: {
        broadcaster_user_id: string;
    };
    transport: TwitchTransport;
};
/** required scopes NONE */
type TwitchEventSubChannelRaid = {
    type: "channel.raid";
    version: "1";
    condition: {
        to_broadcaster_user_id: string;
    };
    transport: TwitchTransport;
};
/** required scopes 'channel:read:polls' */
type TwitchEventSubChannelPollBegin = {
    type: "channel.poll.begin";
    version: "1";
    condition: {
        broadcaster_user_id: string;
    };
    transport: TwitchTransport;
};
/** required scopes 'channel:read:polls' */
type TwitchEventSubChannelPollEnd = {
    type: "channel.poll.end";
    version: "1";
    condition: {
        broadcaster_user_id: string;
    };
    transport: TwitchTransport;
};
/** required scopes 'channel:read:redemptions' */
type TwitchEventSubChannelAutomaticRedemption = {
    type: "channel.channel_points_automatic_reward_redemption.add";
    version: "1";
    condition: {
        broadcaster_user_id: string;
    };
    transport: TwitchTransport;
};
/** required scopes 'channel:read:redemptions' */
type TwitchEventSubChannelCustomRedemption = {
    type: "channel.channel_points_custom_reward_redemption.add";
    version: "1";
    condition: {
        broadcaster_user_id: string;
        reward_id?: string;
    };
    transport: TwitchTransport;
};
export type TwitchEventSub = TwitchEventSubChannelChatMessage |
    TwitchEventSubChannelFollow |
    TwitchEventSubChannelSubscribe |
    TwitchEventSubChannelCheer |
    TwitchEventSubChannelRaid |
    TwitchEventSubChannelPollBegin |
    TwitchEventSubChannelPollEnd |
    TwitchEventSubChannelAutomaticRedemption |
    TwitchEventSubChannelCustomRedemption;

