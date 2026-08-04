import { el, toast } from "../lib/ui.js";
import { icons } from "../lib/icons.js";
import { money, money0, moneySigned, pct, fmtMonth } from "../lib/format.js";
import * as DB from "../data.js";
import { donut, bars, line, CAT_COLORS } from "../charts.js";
import { openExportMenu } from "../export.js";
import { USING_SUPABASE } from "../config.js";
import { countUp } from "../lib/anim.js";
import { pageHead, monthNav, card } from "./shared.js";

export const meta = { id: "dashboard", label: "Dashboard", icon: icons.dashboard };

export function render(root, ctx) {
  // First run — no data yet. Welcome instead of empty zeros.
  if (!DB.hasData()) return renderWelcome(root, ctx);

  const m = ctx.state.month;
  const s = DB.monthlySummary(m);

  const exportBtn = el("button.btn.btn-ghost", { type: "button", title: "Export to a spreadsheet", html: `${icons.download}<span>Export</span>`, onClick: openExportMenu });
  root.append(pageHead("Dashboard", `Your money in ${fmtMonth(m + "-01")}`, [monthNav(ctx), exportBtn]));

  // Carry-over pill — free cash that followed forward from last month.
  if (Math.round(s.carriedOver * 100) !== 0) {
    const pos = s.carriedOver >= 0;
    root.append(el("div.carryover", {}, [
      el(`span.chip.${pos ? "solid-pos" : "solid-neg"}`, { html: `<span class="dot"></span>Carried over ${moneySigned(s.carriedOver)}` }),
      el("span.faint", { style: { fontSize: "var(--text-sm)" }, text: `${money(s.available)} available this month` }),
    ]));
  }

  // --- KPI row (each tile jumps to its detail view) ---
  const kpis = el("div.kpi-grid");
  kpis.append(
    kpi("Net income", s.netIncome, money, `${s.salaryRows.length} cutoff${s.salaryRows.length === 1 ? "" : "s"} recorded`, { feature: true, go: "salary" }),
    kpi("Expenses", s.expenseTotal, money, `${s.monthExpenses.length} transactions`, { go: "expenses" }),
    kpi("Saved", s.savedThisMonth, money, s.savedThisMonth >= 0 ? "added this month" : "net withdrawal", { go: "savings" }),
    kpi("Left over", s.leftOver, money, s.leftOver >= 0 ? "after spend & savings" : "over budget", { negative: s.leftOver < 0, go: "expenses" }),
    kpi("Savings rate", s.savingsRate, pct, "of net income kept", { go: "savings" }),
  );
  bindKpiNav(kpis, ctx);
  root.append(kpis);
  requestAnimationFrame(() => kpis.querySelectorAll(".k-value").forEach((n) => countUp(n, Number(n.dataset.countTo), n._fmt)));

  // --- Insight line ---
  root.append(insight(s));

  // --- Charts + snapshot ---
  const grid = el("div.dash-grid");

  // Expenses by category (donut + legend)
  const cats = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);
  const donutCard = card("Where it went",
    cats.length
      ? el("div", { style: { display: "grid", gridTemplateColumns: "160px 1fr", gap: "var(--space-5)", alignItems: "center" } }, [
          el("div.chart-box", { style: { height: "170px" } }, [el("canvas")]),
          el("ul.legend", {}, cats.map(([name, val], i) =>
            el("li", {}, [
              el("span.swatch", { style: { background: CAT_COLORS()[i % 6] } }),
              el("span", { text: name }),
              el("span.lg-val", { text: money0(val) }),
            ]))),
        ])
      : el("p.muted", { text: "No expenses logged this month." }));
  grid.append(donutCard);
  if (cats.length) donut(donutCard.querySelector("canvas"), { labels: cats.map((c) => c[0]), values: cats.map((c) => c[1]) });

  // Income vs Expense (bar)
  const ieCard = card("Income vs expense", el("div.chart-box", {}, [el("canvas")]));
  grid.append(ieCard);
  bars(ieCard.querySelector("canvas"), {
    labels: ["Net income", "Expenses", "Left over"],
    values: [s.netIncome, s.expenseTotal, Math.max(0, s.leftOver)],
    highlightIndex: 0,
  });

  // Savings trend (line, last 6 months running balance)
  const trend = savingsTrend(6);
  const trendCard = card("Savings trend", el("div.chart-box", {}, [el("canvas")]));
  grid.append(trendCard);
  line(trendCard.querySelector("canvas"), { labels: trend.labels, values: trend.values, label: "Balance" });

  // Debt & receivables snapshot (spans two columns on wide screens)
  grid.append(snapshotCard());

  root.append(grid);
}

function kpi(label, value, format, meta, { feature = false, negative = false, go = null } = {}) {
  const valNode = el(`div.k-value.fig${negative && !feature ? ".neg" : ""}`, { text: format(value) });
  valNode.dataset.countTo = value; valNode._fmt = format;
  return el(`div.kpi${feature ? ".feature" : ""}${go ? ".clickable" : ""}`, go ? { role: "link", tabindex: "0", dataset: { go }, "aria-label": `${label}: ${format(value)}. View ${go}.` } : {}, [
    el("div.k-label", { text: label }),
    valNode,
    el("div.k-meta", { text: meta }),
  ]);
}

// Wire clickable KPIs to navigation (click + Enter/Space).
function bindKpiNav(container, ctx) {
  container.addEventListener("click", (e) => {
    const t = e.target.closest("[data-go]"); if (t) ctx.go(t.dataset.go);
  });
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target.closest("[data-go]"); if (t) { e.preventDefault(); ctx.go(t.dataset.go); }
  });
}

function renderWelcome(root, ctx) {
  const name = (DB.profile().name || "").split(" ")[0] || "there";
  root.append(el("div.welcome.rise", {}, [
    el("div.glyph", { html: icons.spark }),
    el("h2", { text: `Welcome, ${name}` }),
    el("p", { text: "Your money, in one calm place. Start by adding a salary cutoff or an expense — or explore with sample data to see how everything looks." }),
    el("div.actions", {}, [
      el("button.btn.btn-primary", { type: "button", html: `${icons.salary}<span>Add your salary</span>`, onClick: () => ctx.go("salary") }),
      el("button.btn.btn-ghost", { type: "button", html: `${icons.expenses}<span>Log an expense</span>`, onClick: () => ctx.go("expenses") }),
      USING_SUPABASE ? null : el("button.btn.btn-quiet", { type: "button", text: "Load sample data", onClick: () => { DB.loadSample(); toast("Sample data loaded"); ctx.rerender(); } }),
    ]),
  ]));
}

function insight(s) {
  const afterSpend = s.netIncome - s.expenseTotal; // before savings
  let text;
  if (s.netIncome <= 0) {
    text = "No salary recorded for this month yet — add a cutoff to see your full picture.";
  } else if (afterSpend < 0) {
    text = `Heads up — expenses are ${money0(-afterSpend)} over your income this month.`;
  } else if (s.leftOver < 0) {
    text = `You set aside more than what was free — ${money0(-s.leftOver)} of savings came from your buffer.`;
  } else if (s.savingsRate >= 20) {
    text = `Strong month — you saved ${pct(s.savingsRate)} of your net income, ${money0(s.leftOver)} still free.`;
  } else {
    const topCat = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1])[0];
    text = topCat
      ? `Biggest category was ${topCat[0]} at ${money0(topCat[1])}. ${money0(s.leftOver)} left over.`
      : `You have ${money0(s.leftOver)} left over so far this month.`;
  }
  const node = el("div.insight", {}, [el("span.glyph", { html: icons.spark }), el("p", { html: text.replace(/(₱[\d,]+)/g, "<b>$1</b>") })]);
  return node;
}

function snapshotCard() {
  const loan = DB.Loans.all()[0];
  const rows = [];

  if (loan) {
    const bal = DB.loanBalance(loan);
    const paid = loan.original_amount - bal;
    const pctPaid = loan.original_amount ? (paid / loan.original_amount) * 100 : 0;
    rows.push(el("div.line", {}, [
      el("div.between", {}, [el("span", { text: loan.reason }), el("span.num", { text: money(bal) + " left" })]),
      progress(pctPaid),
      el("div.between", {}, [el("span.faint", { text: `${pct(pctPaid)} paid off` }), el("span.faint", { text: `of ${money0(loan.original_amount)}` })]),
    ]));
  }

  const outstanding = DB.Pautang.all().reduce((sum, p) => sum + DB.pautangBalance(p), 0);
  const openCount = DB.Pautang.all().filter((p) => DB.pautangBalance(p) > 0).length;
  rows.push(el("div.line", {}, [
    el("div.between", {}, [el("span", { text: "Pautang outstanding" }), el("span.num", { text: money(outstanding) })]),
    el("div.between", {}, [el("span.faint", { text: `${openCount} still owe you` }), null]),
  ]));

  const c = card("Debt & receivables", el("div.snapshot", {}, rows));
  c.classList.add("col-2");
  return c;
}

function progress(value, positive = true) {
  const bar = el(`div.progress${positive ? ".pos" : ""}`, { role: "progressbar", "aria-valuenow": Math.round(value), "aria-valuemin": 0, "aria-valuemax": 100 });
  const fill = el("span");
  bar.append(fill);
  requestAnimationFrame(() => { fill.style.transform = `scaleX(${Math.min(1, Math.max(0, value / 100))})`; });
  return bar;
}

// Running savings balance at each of the last N month-ends.
function savingsTrend(n) {
  const all = DB.Savings.all().slice().sort((a, b) => a.date.localeCompare(b.date));
  const now = new Date(ctxMonthAnchor());
  const labels = [], values = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // month end
    const cutoff = d.toISOString().slice(0, 10);
    const bal = all.filter((r) => r.date <= cutoff).reduce((s, r) => s + (r.deposit || 0) - (r.withdrawal || 0), 0);
    labels.push(d.toLocaleDateString("en-PH", { month: "short" }));
    values.push(bal);
  }
  return { labels, values };
}
function ctxMonthAnchor() { return new Date(); }
