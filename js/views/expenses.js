import { el, toast, openForm, confirmDialog } from "../lib/ui.js";
import { icons } from "../lib/icons.js";
import { money, money0, fmtDate, todayISO } from "../lib/format.js";
import * as DB from "../data.js";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "../sampleData.js";
import { pageHead, monthNav, card, addButton, rowActions, emptyState } from "./shared.js";

export const meta = { id: "expenses", label: "Expenses", icon: icons.expenses };

function form(ctx, existing) {
  openForm({
    title: existing ? "Edit expense" : "Add expense",
    submitLabel: existing ? "Save changes" : "Add expense",
    values: existing,
    fields: [
      { name: "item", label: "Item", required: true, span: 2, attrs: { placeholder: "e.g. Weekly grocery run" } },
      { name: "amount", label: "Amount", type: "amount", required: true },
      { name: "date", label: "Date", type: "date", value: todayISO() },
      { name: "category", label: "Category", type: "select", options: EXPENSE_CATEGORIES },
      { name: "payment_method", label: "Payment", type: "select", options: PAYMENT_METHODS },
      { name: "merchant", label: "Merchant", span: 2, attrs: { placeholder: "Optional" } },
      { name: "notes", label: "Notes", type: "textarea", span: 2 },
    ],
    onSubmit: async (v) => {
      const row = { ...v, amount: parseFloat(v.amount) || 0, recurring: existing?.recurring || false };
      if (existing) await DB.Expenses.update(existing.id, row);
      else await DB.Expenses.add(row);
      toast(existing ? "Expense updated" : "Expense added");
      ctx.rerender();
    },
  });
}

export function render(root, ctx) {
  const s = DB.monthlySummary(ctx.state.month);
  root.append(pageHead("Expenses", "Every peso out, categorised.", [monthNav(ctx), addButton("Add expense", () => form(ctx))]));

  // Totals strip
  const cats = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);
  const merchants = Object.entries(s.byMerchant).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const days = daysElapsed(ctx.state.month);
  root.append(el("div.tile-grid", {}, [
    tile("Total this month", money(s.expenseTotal), `${s.monthExpenses.length} transactions`),
    tile("Top category", cats[0] ? cats[0][0] : "—", cats[0] ? money0(cats[0][1]) : "no spend yet"),
    tile("Top merchant", merchants[0] ? merchants[0][0] : "—", merchants[0] ? money0(merchants[0][1]) : "no spend yet"),
    tile("Daily average", money0(s.expenseTotal / days), `over ${days} day${days === 1 ? "" : "s"}`),
  ]));

  // List
  const rows = s.monthExpenses.slice().sort((a, b) => b.date.localeCompare(a.date));
  root.append(card("Transactions",
    rows.length
      ? el("div.rows.stagger", {}, rows.map((e) => expenseRow(e, ctx)))
      : emptyState("Nothing logged", "No expenses this month yet.", addButton("Add expense", () => form(ctx)))));
}

function expenseRow(e, ctx) {
  return el("div.list-row", {}, [
    el("div", {}, [
      el("div.lead", { text: e.item }),
      el("div.sub", {}, [
        el("span.chip", { text: e.category }),
        el("span", { text: `  ${fmtDate(e.date)} · ${e.merchant || "—"} · ${e.payment_method}` }),
        e.recurring ? el("span.chip", { style: { marginLeft: "6px" }, text: "recurring" }) : null,
      ]),
    ]),
    el("div.row", { style: { gap: "var(--space-2)", justifySelf: "end" } }, [
      el("span.amount.neg", { text: "−" + money(e.amount) }),
      rowActions(() => form(ctx, e), async () => {
        if (await confirmDialog({ title: "Delete expense?", message: `${e.item} — ${money(e.amount)}.` })) {
          await DB.Expenses.remove(e.id); toast("Expense deleted"); ctx.rerender();
        }
      }),
    ]),
  ]);
}

function tile(label, value, meta) {
  return el("div.tile", {}, [el("div.t-label", { text: label }), el("div.t-value.fig", { text: value }), el("div.k-meta.faint", { text: meta })]);
}
// Days counted for the average: today's date for the current month, else full month length.
function daysElapsed(mKey) {
  const [y, m] = mKey.split("-").map(Number);
  const now = new Date();
  if (now.getFullYear() === y && now.getMonth() === m - 1) return now.getDate();
  return new Date(y, m, 0).getDate();
}
