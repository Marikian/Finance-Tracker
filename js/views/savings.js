import { el, toast, openForm, confirmDialog } from "../lib/ui.js";
import { icons } from "../lib/icons.js";
import { money, money0, pct, fmtDateLong, todayISO } from "../lib/format.js";
import * as DB from "../data.js";
import { pageHead, card, addButton, rowActions, emptyState } from "./shared.js";

export const meta = { id: "savings", label: "Savings", icon: icons.savings };

export function render(root, ctx) {
  const balance = DB.savingsBalance();
  const goal = DB.profile().savingsGoal || 0;
  const pctGoal = goal ? Math.min(100, (balance / goal) * 100) : 0;
  const entries = DB.Savings.all().slice().sort((a, b) => b.date.localeCompare(a.date));

  root.append(pageHead("Savings", "Your running balance and goal.", [
    el("button.btn.btn-ghost", { type: "button", text: "Set goal", onClick: () => goalForm(ctx) }),
    addButton("Add entry", () => form(ctx)),
  ]));

  // Goal hero
  root.append(el("section.card", {}, [
    el("div.between", { style: { alignItems: "flex-end", marginBottom: "var(--space-4)" } }, [
      el("div", {}, [
        el("div.t-label", { text: "Current balance" }),
        el("div.fig", { style: { fontSize: "var(--text-2xl)" }, text: money(balance) }),
      ]),
      el("div.right", {}, [
        el("div.t-label", { text: "Goal" }),
        el("div.fig", { style: { fontSize: "var(--text-lg)" }, text: goal ? money0(goal) : "—" }),
      ]),
    ]),
    goalBar(pctGoal),
    el("div.between", { style: { marginTop: "var(--space-2)" } }, [
      el("span.faint", { style: { fontSize: "var(--text-sm)" }, text: goal ? `${pct(pctGoal)} of goal` : "No goal set yet" }),
      el("span.faint", { style: { fontSize: "var(--text-sm)" }, text: goal ? `${money0(Math.max(0, goal - balance))} to go` : "" }),
    ]),
  ]));

  // Ledger with running balance
  let running = 0;
  const chronological = entries.slice().reverse();
  const withRunning = chronological.map((e) => { running += (e.deposit || 0) - (e.withdrawal || 0); return { ...e, running }; }).reverse();

  root.append(card("Movements",
    entries.length
      ? el("table.table", {}, [
          el("thead", {}, el("tr", {}, [th("Date"), th("Account"), th("In", true), th("Out", true), th("Balance", true), el("th")])),
          el("tbody", {}, withRunning.map((e) => row(e, ctx))),
        ])
      : emptyState("No savings yet", "Add your first deposit to start tracking.", addButton("Add entry", () => form(ctx)))));
}

function row(e, ctx) {
  return el("tr", {}, [
    el("td.muted", { text: fmtDateLong(e.date) }),
    el("td", { text: e.account }),
    el("td.right.amount.pos", { text: e.deposit ? "+" + money(e.deposit) : "—" }),
    el("td.right.amount.neg", { text: e.withdrawal ? "−" + money(e.withdrawal) : "—" }),
    el("td.right.amount", { style: { fontWeight: "650" }, text: money(e.running) }),
    el("td.right", {}, [rowActions(() => form(ctx, e), async () => {
      if (await confirmDialog({ title: "Delete entry?", message: `${fmtDateLong(e.date)} movement will be removed.` })) {
        await DB.Savings.remove(e.id); toast("Deleted"); ctx.rerender();
      }
    })]),
  ]);
}

function form(ctx, existing) {
  openForm({
    title: existing ? "Edit entry" : "Add savings entry",
    submitLabel: existing ? "Save changes" : "Add entry",
    values: existing,
    fields: [
      { name: "account", label: "Account", required: true, span: 2, value: "BPI Save-Up" },
      { name: "date", label: "Date", type: "date", value: todayISO() },
      { name: "deposit", label: "Deposit (in)", type: "amount" },
      { name: "withdrawal", label: "Withdrawal (out)", type: "amount" },
    ],
    onSubmit: async (v) => {
      const row = { account: v.account, date: v.date || todayISO(), deposit: parseFloat(v.deposit) || 0, withdrawal: parseFloat(v.withdrawal) || 0 };
      if (!row.deposit && !row.withdrawal) throw new Error("Enter a deposit or withdrawal");
      if (existing) await DB.Savings.update(existing.id, row); else await DB.Savings.add(row);
      toast(existing ? "Updated" : "Entry added"); ctx.rerender();
    },
  });
}

function goalForm(ctx) {
  openForm({
    title: "Set savings goal",
    submitLabel: "Save goal",
    fields: [{ name: "goal", label: "Target amount", type: "amount", required: true, value: DB.profile().savingsGoal || "" }],
    onSubmit: async (v) => { DB.setSavingsGoal(parseFloat(v.goal) || 0); toast("Goal updated"); ctx.rerender(); },
  });
}

function goalBar(value) {
  const bar = el("div.progress.pos", { style: { height: "12px" }, role: "progressbar", "aria-valuenow": Math.round(value), "aria-valuemin": 0, "aria-valuemax": 100 });
  const fill = el("span"); bar.append(fill);
  requestAnimationFrame(() => { fill.style.transform = `scaleX(${Math.min(1, Math.max(0, value / 100))})`; });
  return bar;
}
function th(label, right) { return el(`th${right ? ".right" : ""}`, { text: label }); }
