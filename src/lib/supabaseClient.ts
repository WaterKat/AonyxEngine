import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { requireEnvAs } from './requireEnvAs.utils.js';
import { Database as DatabasePrivate } from '../types/database.private.types.js';
import { Database as DatabasePublic } from '../types/database.public.types.js';

export const supabaseUrl = requireEnvAs('string', 'SUPABASE_URL');
export const supabaseKey = requireEnvAs('string', 'SUPABASE_SERVICE_KEY');

export const supabasePrivate = createClient<DatabasePrivate>(supabaseUrl, supabaseKey, {
    db: { schema: 'private' }
});

export const supabasePublic = createClient<DatabasePublic>(supabaseUrl, supabaseKey, {
    db: { schema: 'public' }
});
