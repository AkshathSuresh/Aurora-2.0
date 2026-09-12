import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { timeStamp } from "console";

export default async function handler(req: NextApiRequest, res: NextApiResponse){
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const {error} = await supabase
    .from('posts')
    .select('id')
    .limit(1);

    if (error) {
        return res.status(500).json({ok: false, error: error.message});
    }
    return res.status(200).json({ok: true, timeStamp: new Date().toISOString()});
}

