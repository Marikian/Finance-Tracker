// ============================================================
// 2026 PH semi-monthly salary engine  (verified July 2026)
// ------------------------------------------------------------
// Contributions are computed MONTHLY, then split per cutoff (÷2).
// Tax base = period_gross − period_contributions.
// net = period_gross − period_contributions − withholding_tax
//
// Rates live in one place so a future change is a one-line edit.
// ============================================================

export const RATES = {
  sss:       { rate: 0.05,  mscFloor: 5000,  mscCeiling: 35000 }, // employee 5% of MSC → ₱250–₱1,750
  philhealth:{ rate: 0.025, floor: 10000,    ceiling: 100000 },   // 2.5% employee → ₱250–₱2,500
  pagibig:   { rate: 0.02,  cap: 10000 },                          // 2% capped → max ₱200
};

// BIR withholding — SEMI-MONTHLY compensation table (per cutoff).
export const TAX_BRACKETS = [
  { over: 0,       base: 0,        rate: 0    },
  { over: 10417,   base: 0,        rate: 0.15 },
  { over: 16667,   base: 937.50,   rate: 0.20 },
  { over: 33333,   base: 4270.70,  rate: 0.25 },
  { over: 83333,   base: 16770.70, rate: 0.30 },
  { over: 333333,  base: 91770.70, rate: 0.35 },
];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

/** Monthly employee contributions from monthly gross compensation. */
export function monthlyContributions(monthlyGross) {
  const g = Number(monthlyGross) || 0;
  const sss = round2(RATES.sss.rate * clamp(g, RATES.sss.mscFloor, RATES.sss.mscCeiling));
  const philhealth = round2(RATES.philhealth.rate * clamp(g, RATES.philhealth.floor, RATES.philhealth.ceiling));
  const pagibig = round2(RATES.pagibig.rate * Math.min(g, RATES.pagibig.cap));
  return { sss, philhealth, pagibig, total: round2(sss + philhealth + pagibig) };
}

// BIR withholding — MONTHLY compensation table (for whole-month computation).
export const TAX_BRACKETS_MONTHLY = [
  { over: 0,       base: 0,         rate: 0    },
  { over: 20833,   base: 0,         rate: 0.15 },
  { over: 33333,   base: 1875.00,   rate: 0.20 },
  { over: 66667,   base: 8541.80,   rate: 0.25 },
  { over: 166667,  base: 33541.80,  rate: 0.30 },
  { over: 666667,  base: 183541.80, rate: 0.35 },
];

const applyBrackets = (taxable, brackets) => {
  const t = Number(taxable) || 0;
  let b = brackets[0];
  for (const br of brackets) { if (t >= br.over) b = br; else break; }
  return round2(b.base + b.rate * (t - b.over));
};

/** BIR withholding on a per-cutoff (semi-monthly) taxable amount. */
export function withholdingTax(taxable) { return applyBrackets(taxable, TAX_BRACKETS); }
/** BIR withholding on a whole-month taxable amount. */
export function withholdingTaxMonthly(taxable) { return applyBrackets(taxable, TAX_BRACKETS_MONTHLY); }

/**
 * Compute one cutoff's pay.
 * @param {number} cutoffGross  gross for THIS cutoff (15th or 30th)
 * @param {number} [monthlyGross]  full-month gross; defaults to cutoffGross×2
 */
export function computeCutoff(cutoffGross, monthlyGross) {
  const gross = Number(cutoffGross) || 0;
  // No salary entered → no deductions (don't apply the MSC floor to ₱0).
  if (gross <= 0) return { gross: 0, sss: 0, philhealth: 0, pagibig: 0, contributions: 0, taxable: 0, withholdingTax: 0, net: 0 };
  const monthly = Number(monthlyGross) || gross * 2;

  const m = monthlyContributions(monthly);
  // Per-cutoff share of monthly contributions.
  const sss = round2(m.sss / 2);
  const philhealth = round2(m.philhealth / 2);
  const pagibig = round2(m.pagibig / 2);
  const contributions = round2(sss + philhealth + pagibig);

  const taxable = round2(gross - contributions);
  const tax = withholdingTax(taxable);
  const net = round2(gross - contributions - tax);

  return {
    gross,
    sss, philhealth, pagibig,
    contributions,
    taxable,
    withholdingTax: tax,
    net,
  };
}

const ZERO = { gross: 0, sss: 0, philhealth: 0, pagibig: 0, contributions: 0, taxable: 0, withholdingTax: 0, net: 0 };

/**
 * Compute pay for a chosen mode.
 * @param {number} amount  the gross you entered (a cutoff or a month, per mode)
 * @param {"split"|"cutoff"|"monthly"} mode
 *   - split:   `amount` is monthly gross → one cutoff = half gross, half deductions
 *   - cutoff:  `amount` is one cutoff's gross → whole gross, FULL deductions (semi-monthly tax)
 *   - monthly: `amount` is monthly gross → whole month, full deductions, MONTHLY tax
 */
export function computeSalary(amount, mode = "split") {
  const a = Number(amount) || 0;
  if (a <= 0) return { ...ZERO };
  if (mode === "split") return computeCutoff(a / 2, a);

  const monthlyBasis = mode === "cutoff" ? a * 2 : a; // MSC/contribution caps use the monthly figure
  const c = monthlyContributions(monthlyBasis);
  const taxable = round2(a - c.total);
  const tax = mode === "monthly" ? withholdingTaxMonthly(taxable) : withholdingTax(taxable);
  return {
    gross: a,
    sss: c.sss, philhealth: c.philhealth, pagibig: c.pagibig,
    contributions: c.total,
    taxable,
    withholdingTax: tax,
    net: round2(a - c.total - tax),
  };
}
