import { supabasePrivate } from "./supabaseClient.js";
import { requireEnvAs } from "./requireEnvAs.utils.js";
import { decryptToken, encryptToken } from "./utils.js";
import { safelyRun, SafelyResult, safelyWrapError } from './safely.utils.js';

const aonyxEngineSecretKey = requireEnvAs('string', 'AONYXENGINE_SECRET_KEY');
const aonyxengineSecretAlgorithm = 'aes-256-gcm';

const cache = new Map<string, string>();

async function getToken(user_id: string, provider: string, purpose: string, token_type: string): Promise<SafelyResult<string>> {
    const key = `${user_id}.${provider}.${purpose}.${token_type}`;

    if (cache.has(key))
        return {
            ok: true,
            data: cache.get(key),
        }

    const { data: raw_token, error: raw_token_error } = await supabasePrivate.from('oauth_tokens').select('token')
        .eq('user_id', user_id).eq('token_type', token_type).eq('provider', provider).eq('purpose', purpose).single();

    if (raw_token_error)
        return {
            ok: false,
            error: raw_token_error,
        }

    const decrypted_token_request = safelyRun(() => decryptToken(raw_token.token, aonyxengineSecretAlgorithm, aonyxEngineSecretKey));

    if (decrypted_token_request.ok === false)
        return safelyWrapError('failed to decrypt token', decrypted_token_request);

    cache.set(key, decrypted_token_request.data);

    return decrypted_token_request;
}

async function setToken(user_id: string, provider: string, purpose: string, token_type: string, token: string): Promise<SafelyResult<void>> {
    const key = `${user_id}.${provider}.${purpose}.${token_type}`;

    const encrypt_token_request = safelyRun(() => encryptToken(token, aonyxengineSecretAlgorithm, aonyxEngineSecretKey));

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
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        }, { onConflict: 'user_id, token_type' })
        .eq('user_id', user_id).eq('token_type', token_type).single();

    if (raw_token_error)
        return safelyWrapError('failed to set token', raw_token_error);

    cache.set(key, token);
    
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
