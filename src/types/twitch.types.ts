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
