import { supabasePrivate } from "./supabaseClient.js";
import { requireEnvAs } from "./requireEnvAs.utils.js";
import { decryptToken, encryptToken } from "./utils.js";
import { safelyRun, SafelyResult, safelyWrapError } from './safely.utils.js';

const aonyxEngineSecretKey = requireEnvAs('string', 'AONYXENGINE_SECRET_KEY');
const aonyxengineSecretAlgorithm = 'aes-256-gcm';

const cache = new Map<string, string>();

export type TokenData = {
    token: string,
    provider_user_id: string
}

async function getToken(user_id: string, provider: string, purpose: string, token_type: string): Promise<SafelyResult<TokenData>> {
    const key = `${user_id}.${provider}.${purpose}.${token_type}`;

    if (cache.has(key)) {
        const parse = safelyRun(JSON.parse, cache.get(key)) as SafelyResult<TokenData>;
        if (parse.ok === true)
            return parse;
    }

    const { data: raw_token, error: raw_token_error } = await supabasePrivate.from('oauth_tokens').select('token, provider_user_id')
        .eq('user_id', user_id).eq('token_type', token_type).eq('provider', provider).eq('purpose', purpose).single();

    if (raw_token_error)
        return safelyWrapError('failed to fetch token', raw_token_error);

    const decrypt_token_request = safelyRun(() => decryptToken(raw_token.token, aonyxengineSecretAlgorithm, aonyxEngineSecretKey));

    if (decrypt_token_request.ok === false)
        return safelyWrapError('failed to decrypt token', decrypt_token_request);

    const token_data = {
        token: decrypt_token_request.data,
        provider_user_id: raw_token.provider_user_id
    }
    const token_data_string = safelyRun(JSON.stringify, token_data);

    if (token_data_string.ok === false)
        return safelyWrapError('failed to stringify token data', token_data_string);

    cache.set(key, token_data_string.data);
    return { ok: true, data: token_data };
}

async function setToken(user_id: string, provider: string, purpose: string, token_type: string, token_data: TokenData): Promise<SafelyResult<void>> {
    const key = `${user_id}.${provider}.${purpose}.${token_type}`;

    const encrypt_token_request = safelyRun(() => encryptToken(token_data.token, aonyxengineSecretAlgorithm, aonyxEngineSecretKey));

    if (encrypt_token_request.ok === false)
        return safelyWrapError('failed to encrypt token', encrypt_token_request);

    const { data: raw_token, error: raw_token_error } = await supabasePrivate.from('oauth_tokens')
        .upsert({
            user_id,
            provider,
            token: encrypt_token_request.data,
            token_type,
            purpose,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            provider_user_id: token_data.provider_user_id
        }, { onConflict: 'user_id, provider, purpose, token_type' })
        .eq('user_id', user_id).eq('token_type', token_type).eq('provider', provider).eq('purpose', purpose).single();

    if (raw_token_error) {
        return safelyWrapError('failed to post token', raw_token_error);
    }

    const token_data_string = safelyRun(JSON.stringify, token_data);

    if (token_data_string.ok === false)
        return safelyWrapError('failed to stringify token data', token_data_string);

    cache.set(key, token_data_string.data);

    return {
        ok: true,
        data: undefined
    }
}

type TokenManager = {
    get: typeof getToken;
    set: typeof setToken;
}

export const TokenManager: TokenManager = {
    get: getToken,
    set: setToken
}
