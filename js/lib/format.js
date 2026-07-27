// Formatting helpers — currency (₱), numbers, dates.
import { CONFIG } from "../config.js";

const peso = new Intl.NumberFormat(CONFIG.locale, {
  style: "currency", currency: CONFIG.currency,
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const pesoWhole = new Intl.NumberFormat(CONFIG.locale, {
  style: "currency", currency: CONFIG.currency,
  minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const pesoCompact = new Intl.NumberFormat(CONFIG.locale, {
  style: "currency", currency: CONFIG.currency, notation: "compact",
  maximumFractionDigits: 1,
});

/** ₱1,234.56 */
export const money = (n) => peso.format(Number(n) || 0);
/** ₱1,235 (no centavos) */
export const money0 = (n) => pesoWhole.format(Number(n) || 0);
/** ₱1.2K / ₱1.2M — for tight chart labels */
export const moneyK = (n) => pesoCompact.format(Number(n) || 0);
/** Signed: +₱100.00 / −₱100.00 (real minus glyph) */
export const moneySigned = (n) => (n >= 0 ? "+" : "−") + money(Math.abs(n));

export const pct = (n) => `${Math.round(Number(n) || 0)}%`;

// --- Dates (input strings are ISO yyyy-mm-dd) ---
const parse = (d) => (d instanceof Date ? d : new Date(d + "T00:00:00"));

export const fmtDate = (d) =>
  parse(d).toLocaleDateString(CONFIG.locale, { month: "short", day: "numeric" });
export const fmtDateLong = (d) =>
  parse(d).toLocaleDateString(CONFIG.locale, { month: "long", day: "numeric", year: "numeric" });
export const fmtMonth = (d) =>
  parse(d).toLocaleDateString(CONFIG.locale, { month: "long", year: "numeric" });

export const monthKey = (d) => {
  const dt = parse(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Initials for the avatar. */
export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
