import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';


const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey)


const authRouter = Router();


authRouter.get('/auth/discord', async (req, res) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',

    })

    if (error) {
        res.status(500).send("there was an error getting your request");
        return;
    }

    if (data.url)
        res.redirect(data.url);
});


authRouter.get('/auth/twitch', async (req, res) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'twitch',

    })

    if (error) {
        res.status(500).send("there was an error getting your request");
        return;
    }

    if (data.url)
        res.redirect(data.url);
});


export default authRouter;
