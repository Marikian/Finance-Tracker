import { el, toast, confirmDialog } from "../lib/ui.js";
import { icons } from "../lib/icons.js";
import { money, fmtDateLong, todayISO } from "../lib/format.js";
import * as DB from "../data.js";
import { computeCutoff } from "../salary.js";
import { pageHead, card, rowActions, emptyState, scrollTable } from "./shared.js";

export const meta = { id: "salary", label: "Salary", icon: icons.salary };

export function render(root, ctx) {
  root.append(pageHead("Salary", "Enter your monthly gross — it's split per cutoff (15th & 30th) with half the deductions."));

  const layout = el("div.salary-layout");

  // --- Live calculator ---
  const monthlyInput = el("input.input", { type: "number", step: "0.01", min: "0", inputmode: "decimal", placeholder: "45,000.00" });
  const allowanceInput = el("input.input", { type: "number", step: "0.01", min: "0", inputmode: "decimal", placeholder: "0.00" });
  const incentiveInput = el("input.input", { type: "number", step: "0.01", min: "0", inputmode: "decimal", placeholder: "0.00" });
  const periodSel = el("select.select", {}, [
    el("option", { value: "1st cutoff", text: "1st cutoff (15th)" }),
    el("option", { value: "2nd cutoff", text: "2nd cutoff (30th)" }),
  ]);
  const dateInput = el("input.input", { type: "date", value: todayISO() });

  const breakdown = el("div.breakdown");
  const netHero = el("div.net-hero");

  // Input is the FULL monthly gross; a cutoff (15th/30th) is half of everything.
  const recalc = () => {
    const monthly = parseFloat(monthlyInput.value) || 0;
    const allowance = parseFloat(allowanceInput.value) || 0;
    const incentive = parseFloat(incentiveInput.value) || 0;
    const r = computeCutoff(monthly / 2, monthly);
    paintBreakdown(breakdown, r, allowance, incentive);
    paintNet(netHero, r, allowance, incentive);
  };
  [monthlyInput, allowanceInput, incentiveInput].forEach((i) => i.addEventListener("input", recalc));

  const calcCard = card("Calculate a cutoff", [
    el("div.calc-grid", {}, [
      field("Monthly gross", wrapAmount(monthlyInput), "Full month — split across the 15th & 30th"),
      field("Allowance", wrapAmount(allowanceInput), "Optional — this cutoff, not taxed"),
      field("Incentive", wrapAmount(incentiveInput), "Optional — bonus / performance"),
      field("Period", periodSel),
      field("Pay date", dateInput),
    ]),
    breakdown,
    el("div", { style: { marginTop: "var(--space-5)" } }, [
      el("button.btn.btn-primary", {
        type: "button", html: `${icons.plus}<span>Save this cutoff</span>`,
        onClick: async () => {
          const monthly = parseFloat(monthlyInput.value) || 0;
          if (monthly <= 0) return toast("Enter your monthly gross first", "err");
          await DB.Salary.add({
            pay_date: dateInput.value || todayISO(),
            period: periodSel.value,
            gross: monthly / 2,
            monthly_gross: monthly,
            allowance: parseFloat(allowanceInput.value) || 0,
            incentive: parseFloat(incentiveInput.value) || 0,
          });
          toast("Cutoff saved");
          ctx.rerender();
        },
      }),
    ]),
  ]);

  layout.append(calcCard, netHero);
  root.append(layout);

  // --- Saved cutoffs ---
  const rows = DB.Salary.all().slice().sort((a, b) => b.pay_date.localeCompare(a.pay_date));
  const listCard = card("Saved cutoffs",
    rows.length
      ? scrollTable(el("table.table", {}, [
          el("thead", {}, el("tr", {}, [
            th("Pay date"), th("Period"), th("Gross", true), th("Deductions", true), th("Take-home", true), el("th", { style: { width: "70px" } }),
          ])),
          el("tbody", {}, rows.map((row) => salaryRow(row, ctx))),
        ]))
      : emptyState("No cutoffs saved", "Use the calculator above to save your first payslip."));
  root.append(listCard);

  recalc();
}

function salaryRow(row, ctx) {
  const r = DB.salaryNet(row);
  const received = DB.salaryReceived(row);
  const extras = (row.allowance || 0) + (row.incentive || 0);
  return el("tr", {}, [
    el("td", { text: fmtDateLong(row.pay_date) }),
    el("td", {}, [el("span.chip", { text: row.period }), extras > 0 ? el("span.chip.solid-pos", { style: { marginLeft: "6px" }, text: "+extras" }) : null]),
    el("td.right.amount", { text: money(r.gross) }),
    el("td.right.amount.muted", { text: money(r.contributions + r.withholdingTax) }),
    el("td.right.amount", { style: { fontWeight: "650" }, title: extras > 0 ? `Net ${money(r.net)} + allowance/incentive ${money(extras)}` : "", text: money(received) }),
    el("td.right", {}, [rowActions(null, async () => {
      if (await confirmDialog({ title: "Delete cutoff?", message: `${fmtDateLong(row.pay_date)} — ${money(received)} take-home. This can't be undone.` })) {
        await DB.Salary.remove(row.id); toast("Cutoff deleted"); ctx.rerender();
      }
    })]),
  ]);
}

function paintBreakdown(node, r, allowance = 0, incentive = 0) {
  const extras = allowance > 0 || incentive > 0;
  const rows = [
    bRow("Gross pay", r.gross),
    bRow("SSS", -r.sss, true),
    bRow("PhilHealth", -r.philhealth, true),
    bRow("Pag-IBIG", -r.pagibig, true),
    bRow("Withholding tax", -r.withholdingTax, true),
  ];
  if (!extras) {
    rows.push(bRowTotal("Net take-home", r.net));
  } else {
    rows.push(bRowSubtotal("Net take-home", r.net));
    if (allowance > 0) rows.push(bRowAdd("Allowance", allowance));
    if (incentive > 0) rows.push(bRowAdd("Incentive", incentive));
    rows.push(bRowTotal("Total received", r.net + allowance + incentive));
  }
  node.replaceChildren(...rows);
}
function paintNet(node, r, allowance = 0, incentive = 0) {
  const extras = allowance + incentive;
  const total = r.net + extras;
  node.replaceChildren(
    el("div.n-label", { text: extras > 0 ? "Total received" : "Net take-home" }),
    el("div.n-value.fig", { text: money(total) }),
    el("div.n-meta", { text: extras > 0
      ? `Net ${money(r.net)} + allowance & incentive ${money(extras)}`
      : `Gross ${money(r.gross)} · deductions ${money(r.contributions + r.withholdingTax)}` }),
    el("div.gauge", {}, gaugeSegments(r, allowance, incentive)),
  );
}
function gaugeSegments(r, allowance = 0, incentive = 0) {
  const extras = allowance + incentive;
  const total = (r.gross + extras) || 1;
  const seg = (val, color) => el("span", { style: { width: `${(val / total) * 100}%`, background: color } });
  return [
    seg(r.net, "var(--positive)"),
    seg(r.contributions, "var(--cat-4)"),
    seg(r.withholdingTax, "var(--accent)"),
    extras > 0 ? seg(extras, "var(--cat-2)") : null,
  ].filter(Boolean);
}

function bRow(label, amount, sub = false) {
  return el(`div.b-row${sub ? ".sub" : ""}`, {}, [
    el("span.b-label", { text: label }),
    el("span.b-amount", { text: (amount < 0 ? "−" : "") + money(Math.abs(amount)) }),
  ]);
}
function bRowTotal(label, amount) {
  return el("div.b-row.total", {}, [
    el("span.b-label", { text: label }),
    el("span.b-amount.fig", { style: { fontSize: "var(--text-lg)" }, text: money(amount) }),
  ]);
}
function bRowSubtotal(label, amount) {
  return el("div.b-row.subtotal", {}, [
    el("span.b-label", { style: { color: "var(--ink)", fontWeight: "600" }, text: label }),
    el("span.b-amount", { style: { fontWeight: "600" }, text: money(amount) }),
  ]);
}
function bRowAdd(label, amount) {
  return el("div.b-row", {}, [
    el("span.b-label", { text: label }),
    el("span.b-amount.pos", { text: "+ " + money(amount) }),
  ]);
}
function field(label, control, hint) {
  return el("div.field", {}, [el("label", { text: label }), control, hint && el("span.hint", { text: hint })]);
}
function wrapAmount(input) {
  input.classList.add("input", "num");
  return el("div.input-group", {}, [el("span.prefix", { text: "₱" }), input]);
}
function th(label, right) { return el(`th${right ? ".right" : ""}`, { text: label }); }
