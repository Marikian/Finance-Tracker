// ============================================================
// Exports (SheetJS, loaded on demand):
//   • Full workbook   — one tab per section (backup / archive).
//   • Transaction report — a single flat ledger: Name · Date · Amount,
//     across salary, expenses, pautang, and loan payments.
// Both download an .xlsx that opens in Google Sheets or Excel.
// ============================================================
import * as DB from "./data.js";
import { todayISO } from "./lib/format.js";
import { el, toast } from "./lib/ui.js";
import { icons } from "./lib/icons.js";

const CDN = "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

async function loadXLSX() {
  try { return await import(/* @vite-ignore */ CDN); }
  catch { toast("Couldn't load the export tool — check your connection.", "err"); return null; }
}

// ---- Full multi-tab workbook ----
export async function exportWorkbook() {
  const XLSX = await loadXLSX(); if (!XLSX) return;
  const wb = XLSX.utils.book_new();
  const sheet = (name, rows) => XLSX.utils.book_append_sheet(wb, rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([["No data yet"]]), name);

  const balance = DB.savingsBalance();
  const owed = DB.Loans.all().reduce((s, l) => s + DB.loanBalance(l), 0);
  const receivable = DB.Pautang.all().reduce((s, p) => s + DB.pautangBalance(p), 0);
  sheet("Summary", [
    { Metric: "Exported", Value: todayISO() },
    { Metric: "Account", Value: DB.profile().name || "" },
    { Metric: "Savings balance", Value: balance },
    { Metric: "Savings goal", Value: DB.profile().savingsGoal || 0 },
    { Metric: "Loans still owed", Value: owed },
    { Metric: "Pautang outstanding", Value: receivable },
  ]);
  sheet("Salary", DB.Salary.all().map((r) => { const c = DB.salaryNet(r); return { "Pay date": r.pay_date, Period: r.period, Gross: r.gross, SSS: c.sss, PhilHealth: c.philhealth, "Pag-IBIG": c.pagibig, "Withholding tax": c.withholdingTax, Net: c.net }; }));
  sheet("Expenses", DB.Expenses.all().slice().sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ Date: e.date, Item: e.item, Category: e.category, Merchant: e.merchant, Amount: e.amount, Payment: e.payment_method, Recurring: e.recurring ? "Yes" : "", Notes: e.notes })));
  sheet("Loans", DB.Loans.all().map((l) => ({ Lender: l.lender, Reason: l.reason, "Original amount": l.original_amount, Balance: DB.loanBalance(l), "Next due": l.next_due || "" })));
  sheet("Loan payments", DB.LoanPayments.all().map((p) => { const loan = DB.Loans.all().find((l) => l.id === p.loan_id); return { Loan: loan ? loan.reason : p.loan_id, Date: p.date, Amount: p.amount }; }));
  sheet("Pautang", DB.Pautang.all().map((p) => ({ Borrower: p.borrower, "Date lent": p.date_lent, Amount: p.amount, Repaid: p.repaid || 0, Balance: DB.pautangBalance(p), Status: DB.pautangStatus(p), Notes: p.notes || "" })));
  let run = 0;
  sheet("Savings", DB.Savings.all().slice().sort((a, b) => a.date.localeCompare(b.date)).map((s) => { run += (s.deposit || 0) - (s.withdrawal || 0); return { Date: s.date, Account: s.account, Deposit: s.deposit || 0, Withdrawal: s.withdrawal || 0, Balance: run }; }));
  sheet("Habits", DB.Habits.all().map((h) => ({ Habit: h.name, "Days done": h.days.length, Days: h.days.slice().sort((a, b) => a - b).join(", ") })));

  XLSX.writeFile(wb, `kwenta-${todayISO()}.xlsx`);
  toast("Exported — open it in Google Sheets");
}

// ---- Flat transaction report: Name · Date · Amount ----
export function buildTransactions() {
  const t = [];
  for (const s of DB.Salary.all()) t.push({ Name: `Salary — ${s.period || "cutoff"}`, Date: s.pay_date, Amount: round2(DB.salaryNet(s).net) });
  for (const e of DB.Expenses.all()) t.push({ Name: `${e.item}${e.category ? ` (${e.category})` : ""}`, Date: e.date, Amount: -round2(e.amount) });
  for (const p of DB.Pautang.all()) t.push({ Name: `Pautang to ${p.borrower}`, Date: p.date_lent, Amount: -round2(p.amount) });
  for (const lp of DB.LoanPayments.all()) { const loan = DB.Loans.all().find((l) => l.id === lp.loan_id); t.push({ Name: `Loan payment${loan ? ` — ${loan.reason}` : ""}`, Date: lp.date, Amount: -round2(lp.amount) }); }
  return t.filter((r) => r.Date).sort((a, b) => String(a.Date).localeCompare(String(b.Date)));
}

export async function exportTransactionReport() {
  const XLSX = await loadXLSX(); if (!XLSX) return;
  const rows = buildTransactions();
  if (!rows.length) { toast("Nothing to report yet — add some transactions first.", "err"); return; }
  const total = rows.reduce((s, r) => s + r.Amount, 0);
  const data = [...rows, { Name: "Net total", Date: "", Amount: round2(total) }];
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 34 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  XLSX.writeFile(wb, `kwenta-transactions-${todayISO()}.xlsx`);
  toast("Transaction report exported");
}

// ---- Chooser dialog ----
export function openExportMenu() {
  const dlg = el("dialog.modal", { "aria-label": "Export" });
  const choice = (title, desc, onClick) => el("button.export-choice", { type: "button", onClick: () => { dlg.close(); onClick(); } }, [
    el("span.ec-icon", { html: icons.download }),
    el("span", {}, [el("span.ec-title", { text: title }), el("span.ec-desc", { text: desc })]),
  ]);
  dlg.append(
    el("div.modal-head", {}, [el("h3", { text: "Export your data" }), el("button.btn-icon.btn-quiet", { type: "button", "aria-label": "Close", html: icons.close, onClick: () => dlg.close() })]),
    el("div.modal-body", { style: { paddingBottom: "var(--space-5)" } }, [
      el("div.export-choices", {}, [
        choice("Transaction report", "One sheet — Name · Date · Amount, every transaction.", exportTransactionReport),
        choice("Full workbook", "A tab per section (salary, expenses, loans, pautang, savings).", exportWorkbook),
      ]),
    ]),
  );
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
}
