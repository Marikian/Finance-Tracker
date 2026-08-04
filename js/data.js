// ============================================================
// Data layer — the ONE seam between the UI and the backend.
//
// Two modes, one API (views never change):
//  • Supabase (USING_SUPABASE): rows live in Postgres behind RLS.
//    On login we load the signed-in user's rows into an in-memory
//    cache so views read synchronously; writes go to Supabase AND
//    update the cache.
//  • Preview: the same cache, persisted to localStorage.
// ============================================================
import { seed } from "./sampleData.js";
import { computeSalary } from "./salary.js";
import { monthlyContributions } from "./salary.js";
import { monthKey } from "./lib/format.js";
import { USING_SUPABASE } from "./config.js";
import { getClient } from "./lib/supabase.js";

const KEY = "ft.db.v1";
const TABLES = ["salary", "expenses", "loans", "loan_payments", "pautang", "savings", "habits"];

// PostgREST can serialize numeric columns as strings — coerce so all
// downstream arithmetic (sums, reduces) stays numeric, never concatenated.
const NUMERIC_FIELDS = {
  salary: ["gross", "monthly_gross", "allowance", "incentive"],
  expenses: ["amount"],
  loans: ["original_amount"],
  loan_payments: ["amount"],
  pautang: ["amount", "repaid"],
  savings: ["deposit", "withdrawal"],
  habits: [],
};
function coerceNumbers(table, row) {
  for (const f of NUMERIC_FIELDS[table] || []) if (row[f] != null) row[f] = Number(row[f]);
  return row;
}

function emptyDb() {
  return {
    profile: { name: "", email: "", savingsGoal: 0, customDeductions: false, deductions: { sss: 0, philhealth: 0, pagibig: 0 } },
    salary: [], expenses: [], loans: [], loan_payments: [], pautang: [], savings: [], habits: [],
  };
}

// ---------- local persistence (preview mode only) ----------
function loadLocal() {
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...emptyDb(), ...JSON.parse(raw) }; } catch { /* corrupt */ }
  const fresh = emptyDb(); saveLocal(fresh); return fresh;
}
function saveLocal(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* quota */ } }

let db = USING_SUPABASE ? emptyDb() : loadLocal();
const commit = () => { if (!USING_SUPABASE) saveLocal(db); };
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

// ---------- sync (Supabase → cache) ----------
export async function sync() {
  if (!USING_SUPABASE) { db = loadLocal(); return; }
  const sb = await getClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { db = emptyDb(); return; }

  const results = await Promise.all(TABLES.map((t) => sb.from(t).select("*")));
  const next = emptyDb();
  TABLES.forEach((t, i) => { next[t] = (results[i].data || []).map((row) => coerceNumbers(t, row)); });

  const { data: prof } = await sb.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  next.profile = {
    name: prof?.name || user.user_metadata?.name || "", email: user.email || "", savingsGoal: Number(prof?.savings_goal) || 0,
    customDeductions: !!prof?.custom_deductions,
    deductions: { sss: Number(prof?.ded_sss) || 0, philhealth: Number(prof?.ded_philhealth) || 0, pagibig: Number(prof?.ded_pagibig) || 0 },
  };
  db = next;
}

export function clearCache() { db = emptyDb(); }

// ---------- profile ----------
export const profile = () => db.profile;
export async function setProfile(patch) {
  Object.assign(db.profile, patch);
  if (USING_SUPABASE) {
    const sb = await getClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) await sb.from("profiles").upsert({ user_id: user.id, name: db.profile.name }, { onConflict: "user_id" });
  } else commit();
}
export async function setSavingsGoal(v) {
  db.profile.savingsGoal = Number(v) || 0;
  if (USING_SUPABASE) {
    const sb = await getClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) await sb.from("profiles").upsert({ user_id: user.id, savings_goal: db.profile.savingsGoal }, { onConflict: "user_id" });
  } else commit();
}
/** Save the user's fixed monthly deductions (and whether to use them). */
export async function setDeductions({ custom, sss, philhealth, pagibig }) {
  db.profile.customDeductions = !!custom;
  db.profile.deductions = { sss: Number(sss) || 0, philhealth: Number(philhealth) || 0, pagibig: Number(pagibig) || 0 };
  if (USING_SUPABASE) {
    const sb = await getClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) await sb.from("profiles").upsert({
      user_id: user.id,
      custom_deductions: db.profile.customDeductions,
      ded_sss: db.profile.deductions.sss, ded_philhealth: db.profile.deductions.philhealth, ded_pagibig: db.profile.deductions.pagibig,
    }, { onConflict: "user_id" });
  } else commit();
}

// ---------- generic collection ----------
function collection(name, prefix) {
  return {
    all: () => db[name].slice(),
    add: async (row) => {
      if (USING_SUPABASE) {
        const sb = await getClient();
        const { data, error } = await sb.from(name).insert(row).select().single();
        if (error) throw new Error(error.message);
        db[name].push(data); return data;
      }
      const r = { id: uid(prefix), ...row }; db[name].push(r); commit(); return r;
    },
    update: async (id, patch) => {
      if (USING_SUPABASE) {
        const sb = await getClient();
        const { data, error } = await sb.from(name).update(patch).eq("id", id).select().single();
        if (error) throw new Error(error.message);
        const i = db[name].findIndex((x) => x.id === id); if (i > -1) db[name][i] = data; return data;
      }
      const r = db[name].find((x) => x.id === id); if (r) Object.assign(r, patch); commit(); return r;
    },
    remove: async (id) => {
      if (USING_SUPABASE) {
        const sb = await getClient();
        const { error } = await sb.from(name).delete().eq("id", id);
        if (error) throw new Error(error.message);
      }
      db[name] = db[name].filter((x) => x.id !== id); commit();
    },
  };
}

export const Salary   = collection("salary", "sal");
export const Expenses = collection("expenses", "exp");
export const Loans    = collection("loans", "loan");
export const Pautang  = collection("pautang", "pt");
export const Savings  = collection("savings", "sv");

export const LoanPayments = {
  all: () => db.loan_payments.slice(),
  forLoan: (loanId) => db.loan_payments.filter((p) => p.loan_id === loanId),
  add: async (row) => {
    if (USING_SUPABASE) {
      const sb = await getClient();
      const { data, error } = await sb.from("loan_payments").insert(row).select().single();
      if (error) throw new Error(error.message);
      db.loan_payments.push(data); return data;
    }
    const r = { id: uid("lp"), ...row }; db.loan_payments.push(r); commit(); return r;
  },
  remove: async (id) => {
    if (USING_SUPABASE) { const sb = await getClient(); const { error } = await sb.from("loan_payments").delete().eq("id", id); if (error) throw new Error(error.message); }
    db.loan_payments = db.loan_payments.filter((p) => p.id !== id); commit();
  },
};

export const Habits = {
  all: () => db.habits.slice(),
  add: async (name) => {
    if (USING_SUPABASE) {
      const sb = await getClient();
      const { data, error } = await sb.from("habits").insert({ name, days: [] }).select().single();
      if (error) throw new Error(error.message);
      db.habits.push(data); return data;
    }
    const r = { id: uid("h"), name, days: [] }; db.habits.push(r); commit(); return r;
  },
  remove: async (id) => {
    if (USING_SUPABASE) { const sb = await getClient(); const { error } = await sb.from("habits").delete().eq("id", id); if (error) throw new Error(error.message); }
    db.habits = db.habits.filter((h) => h.id !== id); commit();
  },
  toggle: async (id, day) => {
    const h = db.habits.find((x) => x.id === id); if (!h) return;
    const days = h.days.includes(day) ? h.days.filter((d) => d !== day) : [...h.days, day];
    if (USING_SUPABASE) {
      const sb = await getClient();
      const { data, error } = await sb.from("habits").update({ days }).eq("id", id).select().single();
      if (error) throw new Error(error.message); h.days = data.days;
    } else { h.days = days; commit(); }
  },
};

// ---------- sample data / reset (preview mode only) ----------
export function resetData() {
  if (USING_SUPABASE) return;
  const { name, email } = db.profile; db = emptyDb(); db.profile.name = name; db.profile.email = email; commit();
}
export function loadSample() {
  if (USING_SUPABASE) return;
  const p = { ...db.profile }; db = seed(); if (p.name) db.profile.name = p.name; if (p.email) db.profile.email = p.email; commit();
}
export const hasData = () => TABLES.some((k) => k !== "loan_payments" && k !== "habits" ? db[k].length > 0 : false);

// Suggest habits from recurring spending patterns (frequent merchants /
// categories) that aren't already tracked. Empty when there's no clear pattern.
const CATEGORY_HABIT = {
  Dining: "Eat at home",
  Transport: "Commute without ride-hailing",
  Shopping: "No impulse buys",
  Subscriptions: "Review subscriptions",
  Others: "Cut back on extras",
};
export function suggestedHabits() {
  const existing = new Set(db.habits.map((h) => h.name.trim().toLowerCase()));
  const byMerchant = {}, byCategory = {};
  for (const e of db.expenses) {
    const m = (e.merchant || "").trim();
    if (m && m !== "—") byMerchant[m] = (byMerchant[m] || 0) + 1;
    if (e.category) byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  }
  const out = [];
  const push = (name, reason) => {
    const key = name.trim().toLowerCase();
    if (!existing.has(key) && !out.some((s) => s.name.toLowerCase() === key)) out.push({ name, reason });
  };
  // Repeated merchant (≥3 visits) → a "skip" habit.
  Object.entries(byMerchant).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1])
    .forEach(([m, c]) => push(`Skip ${m}`, `${c} purchases at ${m}`));
  // Frequent category (≥4 expenses) → a mapped positive habit.
  Object.entries(byCategory).filter(([, c]) => c >= 4).sort((a, b) => b[1] - a[1])
    .forEach(([cat, c]) => { if (CATEGORY_HABIT[cat]) push(CATEGORY_HABIT[cat], `${c} ${cat.toLowerCase()} expenses`); });
  return out.slice(0, 3);
}

// ---------- derived selectors (pure, read the cache) ----------
export const loanBalance = (loan) =>
  Math.max(0, loan.original_amount - LoanPayments.forLoan(loan.id).reduce((s, p) => s + p.amount, 0));

export const pautangBalance = (p) => Math.max(0, p.amount - (p.repaid || 0));
export const pautangStatus = (p) => {
  const r = p.repaid || 0;
  if (r <= 0) return "Unpaid";
  if (r >= p.amount) return "Paid";
  return "Partial";
};

export const savingsBalance = () =>
  db.savings.reduce((s, r) => s + (r.deposit || 0) - (r.withdrawal || 0), 0);

export const salaryNet = (row) => {
  const mode = row.pay_mode || "split";
  const override = db.profile.customDeductions ? db.profile.deductions : null;
  return computeSalary(row.gross, mode, override);
};
// Total actually received: net take-home + optional (non-taxed) allowance & incentive.
export const salaryReceived = (row) => salaryNet(row).net + (row.allowance || 0) + (row.incentive || 0);

// Total take-home earned across a month range (yyyy-mm, inclusive; null = open end).
export const accumulatedIncome = (fromKey, toKey) =>
  db.salary
    .filter((r) => { const k = monthKey(r.pay_date); return (!fromKey || k >= fromKey) && (!toKey || k <= toKey); })
    .reduce((a, r) => a + salaryReceived(r), 0);

// Earliest / latest month that has a salary entry.
export function incomeMonthBounds() {
  const keys = db.salary.map((s) => monthKey(s.pay_date)).sort();
  return { first: keys[0] || null, last: keys[keys.length - 1] || null };
}

export function monthlySummary(mKey) {
  const inMonth = (d) => monthKey(d) === mKey;
  const salaryRows = db.salary.filter((s) => inMonth(s.pay_date));
  const netIncome = salaryRows.reduce((s, r) => s + salaryReceived(r), 0);
  const grossIncome = salaryRows.reduce((s, r) => s + r.gross, 0);
  const allowanceTotal = salaryRows.reduce((s, r) => s + (r.allowance || 0), 0);
  const incentiveTotal = salaryRows.reduce((s, r) => s + (r.incentive || 0), 0);
  const monthExpenses = db.expenses.filter((e) => inMonth(e.date));
  const expenseTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = {};
  for (const e of monthExpenses) byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  const byMerchant = {};
  for (const e of monthExpenses) byMerchant[e.merchant || "—"] = (byMerchant[e.merchant || "—"] || 0) + e.amount;
  const savedThisMonth = db.savings.filter((r) => inMonth(r.date)).reduce((s, r) => s + (r.deposit || 0) - (r.withdrawal || 0), 0);
  // What's actually free: income minus what you spent AND what you set aside.
  const leftOver = netIncome - expenseTotal - savedThisMonth;
  const savingsRate = netIncome > 0 ? (savedThisMonth / netIncome) * 100 : 0;

  return { mKey, salaryRows, monthExpenses, netIncome, grossIncome, allowanceTotal, incentiveTotal, expenseTotal, byCategory, byMerchant, savedThisMonth, leftOver, savingsRate };
}

export function monthsWithData() {
  const set = new Set();
  db.salary.forEach((s) => set.add(monthKey(s.pay_date)));
  db.expenses.forEach((e) => set.add(monthKey(e.date)));
  db.savings.forEach((s) => set.add(monthKey(s.date)));
  return [...set].sort().reverse();
}

export { monthlyContributions };
