// ============================================================
// App configuration
// ------------------------------------------------------------
// The publishable (anon) key is SAFE to commit and ship publicly —
// Row-Level Security is the real protection: every row is stamped with
// user_id = auth.uid(), and policies only ever return your own rows.
// The service_role/secret key must NEVER appear in this file.
// ============================================================

export const CONFIG = {
  SUPABASE_URL: "https://wnfoojbuvdrjxtcfmkhp.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_M0BF1CobhC8PyE3sF_bPBQ_QCfwkYez",

  currency: "PHP",
  locale: "en-PH",
  owner: "Mark",
};

// With both keys present, the app runs against Supabase (real auth + synced
// data). Blank them out to fall back to local preview data.
export const USING_SUPABASE = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_PUBLISHABLE_KEY);
