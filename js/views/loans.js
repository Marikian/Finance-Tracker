import { el, toast, openForm, confirmDialog } from "../lib/ui.js";
import { icons } from "../lib/icons.js";
import { money, money0, pct, fmtDate, fmtDateLong, todayISO } from "../lib/format.js";
import * as DB from "../data.js";
import { pageHead, card, addButton, rowActions, emptyState } from "./shared.js";

export const meta = { id: "loans", label: "Loans", icon: icons.loans };

export function render(root, ctx) {
  const loans = DB.Loans.all();
  const totalOwed = loans.reduce((s, l) => s + DB.loanBalance(l), 0);
  const totalOriginal = loans.reduce((s, l) => s + l.original_amount, 0);

  root.append(pageHead("Loans", "Money you owe — utang.", [addButton("Add loan", () => loanForm(ctx))]));

  root.append(el("div.tile-grid", {}, [
    tile("Still owed", money(totalOwed), `across ${loans.length} loan${loans.length === 1 ? "" : "s"}`),
    tile("Paid off", money(totalOriginal - totalOwed), `of ${money0(totalOriginal)} borrowed`),
    tile("Progress", pct(totalOriginal ? ((totalOriginal - totalOwed) / totalOriginal) * 100 : 0), "overall paid down"),
  ]));

  if (!loans.length) { root.append(emptyState("No loans", "You're debt-free here. Add a loan to track payoff.", addButton("Add loan", () => loanForm(ctx)))); return; }

  for (const loan of loans) root.append(loanCard(loan, ctx));
}

function loanCard(loan, ctx) {
  const bal = DB.loanBalance(loan);
  const paid = loan.original_amount - bal;
  const pctPaid = loan.original_amount ? (paid / loan.original_amount) * 100 : 0;
  const payments = DB.LoanPayments.forLoan(loan.id).slice().sort((a, b) => b.date.localeCompare(a.date));
  const cleared = bal <= 0;

  const body = el("div.loan-card", {}, [
    el("div.between", {}, [
      el("div", {}, [
        el("div.between", { style: { gap: "10px", justifyContent: "flex-start" } }, [
          el("h3", { style: { fontSize: "var(--text-md)" }, text: loan.reason }),
          cleared ? el("span.chip.solid-pos", { html: `<span class="dot"></span>Cleared` }) : null,
        ]),
        el("div.faint", { style: { fontSize: "var(--text-sm)" }, text: `${loan.lender}${loan.next_due && !cleared ? ` · next due ${fmtDate(loan.next_due)}` : ""}` }),
      ]),
      el("div.right", {}, [
        el("div.fig", { style: { fontSize: "var(--text-xl)" }, text: money(bal) }),
        el("div.faint", { style: { fontSize: "var(--text-sm)" }, text: `of ${money0(loan.original_amount)}` }),
      ]),
    ]),
    progress(pctPaid),
    el("div.between", {}, [
      el("span.faint", { style: { fontSize: "var(--text-sm)" }, text: `${pct(pctPaid)} paid off` }),
      el("div.row.gap-2", {}, [
        !cleared ? el("button.btn.btn-primary.btn-sm", { type: "button", html: `${icons.plus}<span>Log payment</span>`, onClick: () => paymentForm(loan, ctx) }) : null,
        rowActions(() => loanForm(ctx, loan), async () => {
          if (await confirmDialog({ title: "Delete loan?", message: `${loan.reason} and its ${payments.length} payment(s) will be removed.` })) {
            for (const p of payments) await DB.LoanPayments.remove(p.id);
            await DB.Loans.remove(loan.id); toast("Loan deleted"); ctx.rerender();
          }
        }),
      ]),
    ]),
    payments.length ? paymentList(payments, ctx) : null,
  ]);

  return card(null, body);
}

function paymentList(payments, ctx) {
  return el("details", { style: { marginTop: "var(--space-2)" } }, [
    el("summary", { style: { cursor: "pointer", color: "var(--muted)", fontSize: "var(--text-sm)" }, text: `${payments.length} payment${payments.length === 1 ? "" : "s"}` }),
    el("div.rows", { style: { marginTop: "var(--space-2)" } }, payments.map((p) =>
      el("div.list-row", {}, [
        el("div.sub", { text: fmtDateLong(p.date) }),
        el("div.row.gap-2", { style: { justifySelf: "end" } }, [
          el("span.amount.pos", { text: "−" + money(p.amount) }),
          rowActions(null, async () => { await DB.LoanPayments.remove(p.id); toast("Payment removed"); ctx.rerender(); }),
        ]),
      ]))),
  ]);
}

function loanForm(ctx, existing) {
  openForm({
    title: existing ? "Edit loan" : "Add loan",
    submitLabel: existing ? "Save changes" : "Add loan",
    values: existing,
    fields: [
      { name: "reason", label: "What is it for", required: true, span: 2, attrs: { placeholder: "e.g. Emergency loan" } },
      { name: "lender", label: "Lender", required: true, span: 2, attrs: { placeholder: "e.g. BPI Personal Loan" } },
      { name: "original_amount", label: "Original amount", type: "amount", required: true },
      { name: "next_due", label: "Next due", type: "date" },
    ],
    onSubmit: async (v) => {
      const row = { reason: v.reason, lender: v.lender, original_amount: parseFloat(v.original_amount) || 0, next_due: v.next_due || null };
      if (existing) await DB.Loans.update(existing.id, row); else await DB.Loans.add(row);
      toast(existing ? "Loan updated" : "Loan added"); ctx.rerender();
    },
  });
}

function paymentForm(loan, ctx) {
  const bal = DB.loanBalance(loan);
  openForm({
    title: "Log a payment",
    submitLabel: "Add payment",
    fields: [
      { name: "amount", label: "Amount", type: "amount", required: true, hint: `${money(bal)} remaining` },
      { name: "date", label: "Date", type: "date", value: todayISO() },
    ],
    onSubmit: async (v) => {
      const amt = parseFloat(v.amount) || 0;
      if (amt <= 0) throw new Error("Enter an amount");
      await DB.LoanPayments.add({ loan_id: loan.id, date: v.date || todayISO(), amount: amt });
      toast("Payment logged"); ctx.rerender();
    },
  });
}

function tile(label, value, meta) {
  return el("div.tile", {}, [el("div.t-label", { text: label }), el("div.t-value.fig", { text: value }), el("div.k-meta.faint", { text: meta })]);
}
function progress(value) {
  const bar = el("div.progress.pos", { role: "progressbar", "aria-valuenow": Math.round(value), "aria-valuemin": 0, "aria-valuemax": 100 });
  const fill = el("span"); bar.append(fill);
  requestAnimationFrame(() => { fill.style.transform = `scaleX(${Math.min(1, Math.max(0, value / 100))})`; });
  return bar;
}
