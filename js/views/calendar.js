import { el, toast, openForm, confirmDialog } from "../lib/ui.js";
import { icons } from "../lib/icons.js";
import { money, money0, fmtDateLong } from "../lib/format.js";
import * as DB from "../data.js";
import { pageHead, monthNav, card, emptyState } from "./shared.js";

export const meta = { id: "calendar", label: "Calendar", icon: icons.calendar };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function render(root, ctx) {
  const [y, mo] = ctx.state.month.split("-").map(Number);
  root.append(pageHead("Calendar", "Spending by day, and your habits.", [monthNav(ctx)]));

  // --- Spend calendar ---
  const s = DB.monthlySummary(ctx.state.month);
  const byDay = {};
  let maxDay = 0;
  for (const e of s.monthExpenses) {
    const d = new Date(e.date + "T00:00:00").getDate();
    byDay[d] = (byDay[d] || 0) + e.amount;
    maxDay = Math.max(maxDay, byDay[d]);
  }

  const grid = el("div.cal-grid");
  WEEKDAYS.forEach((w) => grid.append(el("div.cal-head", { text: w })));

  const firstDow = new Date(y, mo - 1, 1).getDay();
  const daysInMonth = new Date(y, mo, 0).getDate();
  const today = new Date();
  const isThisMonth = today.getFullYear() === y && today.getMonth() === mo - 1;

  for (let i = 0; i < firstDow; i++) grid.append(el("div.cal-cell.empty"));
  for (let d = 1; d <= daysInMonth; d++) {
    const spend = byDay[d] || 0;
    const intensity = maxDay ? (spend / maxDay) * 0.16 + (spend ? 0.05 : 0) : 0;
    const isToday = isThisMonth && today.getDate() === d;
    const cell = el(`button.cal-cell${isToday ? ".today" : ""}`, {
      type: "button",
      "aria-label": `${WEEKDAYS[(firstDow + d - 1) % 7]} ${d} — ${spend ? money(spend) : "no spend"}`,
      style: { "--intensity": String(intensity) },
      onClick: () => dayDetail(ctx.state.month, d, s.monthExpenses),
    }, [
      el("span.spend-dot"),
      el("span.d-num", { text: String(d) }),
      spend ? el("span.d-amt", { text: money0(spend) }) : null,
    ]);
    grid.append(cell);
  }

  root.append(card("Purchases this month", grid,
    el("span.count-badge", { text: money0(s.expenseTotal) })));

  // --- Habits ---
  const habits = DB.Habits.all();
  const habitBody = habits.length
    ? el("div.habits", {}, habits.map((h) => habitRow(h, daysInMonth, ctx)))
    : emptyState("No habits yet", "Track routines like gym, commute, or coffee-at-home.");

  root.append(card("Habit tracker", habitBody,
    el("button.btn.btn-ghost.btn-sm", { type: "button", html: `${icons.plus}<span>Add habit</span>`, onClick: () => addHabit(ctx) })));

  // --- Suggested habits, from spending patterns ---
  const suggestions = DB.suggestedHabits();
  if (suggestions.length) {
    root.append(card("Suggested from your spending",
      el("div.rows", {}, suggestions.map((s) => suggestionRow(s, ctx))),
      el("span.chip", { html: `${icons.spark}<span>auto</span>` })));
  }
}

function suggestionRow(s, ctx) {
  return el("div.list-row", {}, [
    el("div", {}, [el("div.lead", { text: s.name }), el("div.sub", { text: s.reason })]),
    el("button.btn.btn-ghost.btn-sm", { type: "button", style: { justifySelf: "end" }, html: `${icons.plus}<span>Track</span>`,
      onClick: async () => { await DB.Habits.add(s.name); toast(`Tracking "${s.name}"`); ctx.rerender(); } }),
  ]);
}

function habitRow(h, daysInMonth, ctx) {
  const checks = el("div.habit-checks");
  for (let d = 1; d <= daysInMonth; d++) {
    const on = h.days.includes(d);
    checks.append(el(`button.habit-check${on ? ".on" : ""}`, {
      type: "button", title: `Day ${d}`, "aria-label": `${h.name}, day ${d}${on ? " (done)" : ""}`, "aria-pressed": on ? "true" : "false",
      onClick: async () => { await DB.Habits.toggle(h.id, d); ctx.rerender(); },
    }));
  }
  return el("div.habit-row", {}, [
    el("div", {}, [
      el("span.h-name", { text: h.name }),
      el("button.btn-icon.btn-quiet.btn-sm", { type: "button", "aria-label": "Delete habit", html: icons.trash, style: { marginLeft: "6px" }, onClick: async () => {
        if (await confirmDialog({ title: "Delete habit?", message: `"${h.name}" and its checks will be removed.` })) { await DB.Habits.remove(h.id); toast("Habit removed"); ctx.rerender(); }
      } }),
    ]),
    checks,
    el("span.h-count", { text: `${h.days.filter((d) => d <= daysInMonth).length}/${daysInMonth}` }),
  ]);
}

function addHabit(ctx) {
  openForm({
    title: "Add habit",
    submitLabel: "Add",
    fields: [{ name: "name", label: "Habit", required: true, span: 2, attrs: { placeholder: "e.g. Coffee at home" } }],
    onSubmit: async (v) => { await DB.Habits.add(v.name); toast("Habit added"); ctx.rerender(); },
  });
}

function dayDetail(mKey, day, monthExpenses) {
  const [y, mo] = mKey.split("-").map(Number);
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const items = monthExpenses.filter((e) => e.date === iso);
  const total = items.reduce((s, e) => s + e.amount, 0);
  const dlg = el("dialog.modal", { "aria-label": "Day detail" });
  dlg.append(
    el("div.modal-head", {}, [
      el("h3", { text: fmtDateLong(iso) }),
      el("button.btn-icon.btn-quiet", { type: "button", "aria-label": "Close", html: icons.close, onClick: () => dlg.close() }),
    ]),
    el("div.modal-body", { style: { paddingBottom: "var(--space-5)" } }, [
      items.length
        ? el("div.rows", {}, items.map((e) => el("div.list-row", {}, [
            el("div", {}, [el("div.lead", { text: e.item }), el("div.sub", {}, [el("span.chip", { text: e.category }), el("span", { text: ` ${e.merchant || "—"}` })])]),
            el("span.amount.neg", { style: { justifySelf: "end" }, text: "−" + money(e.amount) }),
          ])).concat(el("div.between", { style: { paddingTop: "var(--space-3)", fontWeight: "600" } }, [el("span", { text: "Total" }), el("span.amount", { text: money(total) })])))
        : el("p.muted", { text: "No spending logged on this day." }),
    ]),
  );
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
}
