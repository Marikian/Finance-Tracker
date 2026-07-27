import { el, toast, confirmDialog } from "../lib/ui.js";
import { icons } from "../lib/icons.js";
import { money, fmtDateLong, todayISO } from "../lib/format.js";
import * as DB from "../data.js";
import { computeCutoff } from "../salary.js";
import { pageHead, card, rowActions, emptyState } from "./shared.js";

export const meta = { id: "salary", label: "Salary", icon: icons.salary };

export function render(root, ctx) {
  root.append(pageHead("Salary", "Enter a cutoff's gross — the app computes your take-home."));

  const layout = el("div.salary-layout");

  // --- Live calculator ---
  const grossInput = el("input.input", { type: "number", step: "0.01", min: "0", inputmode: "decimal", placeholder: "22,500.00", value: "22500" });
  const monthlyInput = el("input.input", { type: "number", step: "0.01", min: "0", inputmode: "decimal", placeholder: "auto (cutoff × 2)" });
  const periodSel = el("select.select", {}, [
    el("option", { value: "1st cutoff", text: "1st cutoff (15th)" }),
    el("option", { value: "2nd cutoff", text: "2nd cutoff (30th)" }),
  ]);
  const dateInput = el("input.input", { type: "date", value: todayISO() });

  const breakdown = el("div.breakdown");
  const netHero = el("div.net-hero");

  const recalc = () => {
    const gross = parseFloat(grossInput.value) || 0;
    const monthly = parseFloat(monthlyInput.value) || 0;
    const r = computeCutoff(gross, monthly || undefined);
    paintBreakdown(breakdown, r);
    paintNet(netHero, r);
  };
  [grossInput, monthlyInput].forEach((i) => i.addEventListener("input", recalc));

  const calcCard = card("Calculate a cutoff", [
    el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-5)" } }, [
      field("Cutoff gross", wrapAmount(grossInput), "What you're paid this cutoff"),
      field("Monthly gross", wrapAmount(monthlyInput), "Optional — drives SSS/PhilHealth/Pag-IBIG"),
      field("Period", periodSel),
      field("Pay date", dateInput),
    ]),
    breakdown,
    el("div", { style: { marginTop: "var(--space-5)" } }, [
      el("button.btn.btn-primary", {
        type: "button", html: `${icons.plus}<span>Save this cutoff</span>`,
        onClick: async () => {
          const gross = parseFloat(grossInput.value) || 0;
          if (gross <= 0) return toast("Enter a gross amount first", "err");
          await DB.Salary.add({
            pay_date: dateInput.value || todayISO(),
            period: periodSel.value,
            gross,
            monthly_gross: parseFloat(monthlyInput.value) || gross * 2,
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
      ? el("table.table", {}, [
          el("thead", {}, el("tr", {}, [
            th("Pay date"), th("Period"), th("Gross", true), th("Deductions", true), th("Net", true), el("th", { style: { width: "70px" } }),
          ])),
          el("tbody", {}, rows.map((row) => salaryRow(row, ctx))),
        ])
      : emptyState("No cutoffs saved", "Use the calculator above to save your first payslip."));
  root.append(listCard);

  recalc();
}

function salaryRow(row, ctx) {
  const r = DB.salaryNet(row);
  return el("tr", {}, [
    el("td", { text: fmtDateLong(row.pay_date) }),
    el("td", {}, [el("span.chip", { text: row.period })]),
    el("td.right.amount", { text: money(r.gross) }),
    el("td.right.amount.muted", { text: money(r.contributions + r.withholdingTax) }),
    el("td.right.amount", { style: { fontWeight: "650" }, text: money(r.net) }),
    el("td.right", {}, [rowActions(null, async () => {
      if (await confirmDialog({ title: "Delete cutoff?", message: `${fmtDateLong(row.pay_date)} — ${money(r.net)} net. This can't be undone.` })) {
        await DB.Salary.remove(row.id); toast("Cutoff deleted"); ctx.rerender();
      }
    })]),
  ]);
}

function paintBreakdown(node, r) {
  node.replaceChildren(
    bRow("Gross pay", r.gross),
    bRow("SSS", -r.sss, true),
    bRow("PhilHealth", -r.philhealth, true),
    bRow("Pag-IBIG", -r.pagibig, true),
    bRow("Withholding tax", -r.withholdingTax, true),
    bRowTotal("Net take-home", r.net),
  );
}
function paintNet(node, r) {
  node.replaceChildren(
    el("div.n-label", { text: "Net take-home" }),
    el("div.n-value.fig", { text: money(r.net) }),
    el("div.n-meta", { text: `Gross ${money(r.gross)} · deductions ${money(r.contributions + r.withholdingTax)}` }),
    el("div.gauge", {}, gaugeSegments(r)),
  );
}
function gaugeSegments(r) {
  const total = r.gross || 1;
  const seg = (val, color) => el("span", { style: { width: `${(val / total) * 100}%`, background: color } });
  return [
    seg(r.net, "var(--positive)"),
    seg(r.contributions, "var(--cat-4)"),
    seg(r.withholdingTax, "var(--accent)"),
  ];
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
function field(label, control, hint) {
  return el("div.field", {}, [el("label", { text: label }), control, hint && el("span.hint", { text: hint })]);
}
function wrapAmount(input) {
  input.classList.add("input", "num");
  return el("div.input-group", {}, [el("span.prefix", { text: "₱" }), input]);
}
function th(label, right) { return el(`th${right ? ".right" : ""}`, { text: label }); }
