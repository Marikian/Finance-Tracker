// Supabase client — created once, only when configured.
// @supabase/supabase-js v2 loaded from CDN as an ES module.
import { CONFIG, USING_SUPABASE } from "../config.js";

let _client = null;

export async function getClient() {
  if (!USING_SUPABASE) return null;
  if (_client) return _client;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  _client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return _client;
}
