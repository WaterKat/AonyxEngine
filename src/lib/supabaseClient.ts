import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { requireEnvAs } from './requireEnvAs.utils.js';

export const supabaseUrl = requireEnvAs('string', 'SUPABASE_URL');
export const supabaseKey = requireEnvAs('string', 'SUPABASE_SERVICE_KEY');

export const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'private' }
});
