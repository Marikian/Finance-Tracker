import { el, toast, openForm, confirmDialog } from "../lib/ui.js";
import { icons } from "../lib/icons.js";
import { money, money0, fmtDate, todayISO } from "../lib/format.js";
import * as DB from "../data.js";
import { pageHead, card, addButton, rowActions, emptyState } from "./shared.js";

export const meta = { id: "pautang", label: "Pautang", icon: icons.pautang };

export function render(root, ctx) {
  const list = DB.Pautang.all().slice().sort((a, b) => DB.pautangBalance(b) - DB.pautangBalance(a));
  const totalLent = list.reduce((s, p) => s + p.amount, 0);
  const totalRepaid = list.reduce((s, p) => s + (p.repaid || 0), 0);
  const outstanding = totalLent - totalRepaid;

  root.append(pageHead("Pautang", "Money owed to you.", [addButton("Add pautang", () => form(ctx))]));

  root.append(el("div.tile-grid", {}, [
    tile("Out on loan", money(outstanding), `${list.filter((p) => DB.pautangBalance(p) > 0).length} still owe you`),
    tile("Collected", money(totalRepaid), `of ${money0(totalLent)} lent out`),
    tile("Fully repaid", String(list.filter((p) => DB.pautangStatus(p) === "Paid").length), `of ${list.length} people`),
  ]));

  root.append(card("Who owes you",
    list.length
      ? el("table.table", {}, [
          el("thead", {}, el("tr", {}, [th("Borrower"), th("Lent"), th("Amount", true), th("Repaid", true), th("Balance", true), th("Status"), el("th")])),
          el("tbody", {}, list.map((p) => row(p, ctx))),
        ])
      : emptyState("No pautang", "Nobody owes you right now.", addButton("Add pautang", () => form(ctx)))));
}

function row(p, ctx) {
  const bal = DB.pautangBalance(p);
  const status = DB.pautangStatus(p);
  const chipClass = status === "Paid" ? "solid-pos" : status === "Partial" ? "solid-warn" : "solid-neg";
  return el("tr", {}, [
    el("td", {}, [el("div.lead", { text: p.borrower }), p.notes ? el("div.sub", { text: p.notes }) : null]),
    el("td.muted", { text: fmtDate(p.date_lent) }),
    el("td.right.amount", { text: money(p.amount) }),
    el("td.right.amount.pos", { text: money(p.repaid || 0) }),
    el("td.right.amount", { style: { fontWeight: "650" }, text: money(bal) }),
    el("td", {}, [el(`span.chip.${chipClass}`, { html: `<span class="dot"></span>${status}` })]),
    el("td.right", {}, [el("div.row.gap-2", { style: { justifyContent: "flex-end" } }, [
      bal > 0 ? el("button.btn.btn-ghost.btn-sm", { type: "button", text: "Repay", onClick: () => repayForm(p, ctx) }) : null,
      rowActions(() => form(ctx, p), async () => {
        if (await confirmDialog({ title: "Delete pautang?", message: `${p.borrower} — ${money(p.amount)}.` })) {
          await DB.Pautang.remove(p.id); toast("Deleted"); ctx.rerender();
        }
      }),
    ])]),
  ]);
}

function form(ctx, existing) {
  openForm({
    title: existing ? "Edit pautang" : "Add pautang",
    submitLabel: existing ? "Save changes" : "Add",
    values: existing,
    fields: [
      { name: "borrower", label: "Borrower", required: true, span: 2, attrs: { placeholder: "Who borrowed" } },
      { name: "amount", label: "Amount lent", type: "amount", required: true },
      { name: "date_lent", label: "Date lent", type: "date", value: todayISO() },
      { name: "repaid", label: "Already repaid", type: "amount" },
      { name: "notes", label: "Notes", type: "textarea", span: 2 },
    ],
    onSubmit: async (v) => {
      const row = { borrower: v.borrower, amount: parseFloat(v.amount) || 0, date_lent: v.date_lent || todayISO(), repaid: parseFloat(v.repaid) || 0, notes: v.notes || "" };
      if (existing) await DB.Pautang.update(existing.id, row); else await DB.Pautang.add(row);
      toast(existing ? "Updated" : "Added"); ctx.rerender();
    },
  });
}

function repayForm(p, ctx) {
  const bal = DB.pautangBalance(p);
  openForm({
    title: `Record repayment`,
    submitLabel: "Record",
    fields: [{ name: "amount", label: `Amount from ${p.borrower}`, type: "amount", required: true, hint: `${money(bal)} outstanding` }],
    onSubmit: async (v) => {
      const amt = parseFloat(v.amount) || 0;
      if (amt <= 0) throw new Error("Enter an amount");
      await DB.Pautang.update(p.id, { repaid: Math.min(p.amount, (p.repaid || 0) + amt) });
      toast("Repayment recorded"); ctx.rerender();
    },
  });
}

function tile(label, value, meta) {
  return el("div.tile", {}, [el("div.t-label", { text: label }), el("div.t-value.fig", { text: value }), el("div.k-meta.faint", { text: meta })]);
}
function th(label, right) { return el(`th${right ? ".right" : ""}`, { text: label }); }
