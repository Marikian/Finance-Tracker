// ============================================================
// Auth seam — real Supabase Auth when configured, local preview otherwise.
//   Supabase: email + password. RLS (auth.uid() = user_id) keeps every
//   account's data isolated. Only the publishable key ships to the client.
// ============================================================
import { USING_SUPABASE } from "./config.js";
import * as DB from "./data.js";
import { getClient } from "./lib/supabase.js";

const SESSION = "ft.session";

export async function getUser() {
  if (USING_SUPABASE) {
    const sb = await getClient();
    const { data } = await sb.auth.getSession();
    return data.session?.user ? toUser(data.session.user) : null;
  }
  try { return JSON.parse(localStorage.getItem(SESSION)) || null; } catch { return null; }
}

export async function signUp({ name, email, password }) {
  requireName(name); requireEmail(email); requirePassword(password);
  if (USING_SUPABASE) {
    const sb = await getClient();
    const { data, error } = await sb.auth.signUp({ email: normalize(email), password, options: { data: { name: name.trim() } } });
    if (error) throw new Error(friendly(error));
    if (!data.session) { const e = new Error("Account created — check your email to confirm, then sign in."); e.pending = true; throw e; }
    return toUser(data.user);
  }
  const user = { name: name.trim(), email: normalize(email) };
  localStorage.setItem(SESSION, JSON.stringify(user));
  await DB.setProfile({ name: user.name, email: user.email });
  return user;
}

export async function signIn({ email, password }) {
  requireEmail(email);
  if (!password) throw new Error("Enter your password.");
  if (USING_SUPABASE) {
    const sb = await getClient();
    const { data, error } = await sb.auth.signInWithPassword({ email: normalize(email), password });
    if (error) throw new Error(friendly(error));
    return toUser(data.user);
  }
  const existingName = DB.profile().name;
  const user = { name: existingName || nameFromEmail(email), email: normalize(email) };
  localStorage.setItem(SESSION, JSON.stringify(user));
  await DB.setProfile({ email: user.email, ...(existingName ? {} : { name: user.name }) });
  return user;
}

export async function signOut() {
  if (USING_SUPABASE) { const sb = await getClient(); await sb.auth.signOut(); DB.clearCache(); return; }
  localStorage.removeItem(SESSION);
}

// --- helpers ---
function toUser(u) { return { id: u.id, email: u.email, name: u.user_metadata?.name || nameFromEmail(u.email || "") }; }
function friendly(error) {
  const m = error.message || "Something went wrong.";
  if (/invalid login credentials/i.test(m)) return "Wrong email or password.";
  if (/email not confirmed/i.test(m)) return "Please confirm your email first — check your inbox.";
  if (/already registered|already exists/i.test(m)) return "That email already has an account — sign in instead.";
  if (/rate limit/i.test(m)) return "Too many attempts — please wait a moment and try again.";
  return m;
}

export function requireName(n) { if (!n || !n.trim()) throw new Error("What should we call you?"); }
export function requireEmail(e) { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((e || "").trim())) throw new Error("Enter a valid email address."); }
export function requirePassword(p) { if (!p || p.length < 8) throw new Error("Use at least 8 characters for your password."); }

const normalize = (e) => e.trim().toLowerCase();
const nameFromEmail = (e) => (e.split("@")[0] || "").replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
