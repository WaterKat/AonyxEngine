import { randomBytes } from "crypto";
import { SafelyResult, safelyWrapError } from "./safely.utils.js";
import { supabasePrivate } from "./supabaseClient.js";
import { Database } from "../types/database.private.types.js";

const EXPIRATION_TIMEOUT = 1000 * 60 * 5; // 5 minutes

export type StateData = Database['private']['Tables']['oauth_states']['Row'];
type StateDataInsert = Database['private']['Tables']['oauth_states']['Insert']

async function createStateData(user_id: string, provider: string, purpose: string): Promise<SafelyResult<StateData>> {
    const state = randomBytes(16).toString('hex');

    const state_data: StateDataInsert = {
        user_id,
        state,
        provider,
        purpose,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + EXPIRATION_TIMEOUT).toISOString(),
    }

    const { data: inserted_data, error } = await supabasePrivate.from('oauth_states')
        .insert(state_data)
        .select().single();
    if (error)
        return safelyWrapError('failed to post state', error);

    return {
        ok: true,
        data: inserted_data
    }
}

async function useStateData(user_id: string, state: string): Promise<SafelyResult<StateData>> {
    const { data, error } = await supabasePrivate.from('oauth_states')
        .delete().eq('user_id', user_id).eq('state', state)
        .select().single();

    if (error || !data)
        return safelyWrapError('failed to delete state', error ?? new Error(`state ${state} not found`));

    return {
        ok: true,
        data
    }
}

// clean up expired states
setInterval(async () => {
    const { error } = await supabasePrivate.from('oauth_states').delete()
        .lt('expires_at', new Date().toISOString());

    if (error)
        console.error('failed to delete expired states', error);
}, EXPIRATION_TIMEOUT).unref(); //? do not wait on exit

type StateManager = {
    create: (user_id: string, provider: string, purpose: string) => Promise<SafelyResult<StateData>>;
    use: (user_id: string, state: string) => Promise<SafelyResult<StateData>>;
}

export const StateManager: StateManager = {
    create: createStateData,
    use: useStateData
};
