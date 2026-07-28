import { el, toast, confirmDialog } from "../lib/ui.js";
import { icons } from "../lib/icons.js";
import { money, fmtDateLong, todayISO } from "../lib/format.js";
import * as DB from "../data.js";
import { computeSalary } from "../salary.js";
import { pageHead, card, rowActions, emptyState, scrollTable } from "./shared.js";

export const meta = { id: "salary", label: "Salary", icon: icons.salary };

export function render(root, ctx) {
  root.append(pageHead("Salary", "Your take-home, per cutoff or per month."));

  const layout = el("div.salary-layout");

  // --- Live calculator ---
  const grossInput = el("input.input", { id: "sal_gross", type: "number", step: "0.01", min: "0", inputmode: "decimal", placeholder: "45,000.00" });
  const allowanceInput = el("input.input", { type: "number", step: "0.01", min: "0", inputmode: "decimal", placeholder: "0.00" });
  const incentiveInput = el("input.input", { type: "number", step: "0.01", min: "0", inputmode: "decimal", placeholder: "0.00" });
  const modeSel = el("select.select", {}, [
    el("option", { value: "split", text: "Split · cutoffs" }),
    el("option", { value: "monthly", text: "Whole month" }),
  ]);
  const periodSel = el("select.select", {}, [
    el("option", { value: "1st cutoff", text: "1st cutoff · 15th" }),
    el("option", { value: "2nd cutoff", text: "2nd cutoff · 30th" }),
  ]);
  const dateInput = el("input.input", { type: "date", value: todayISO() });

  const breakdown = el("div.breakdown");
  const netHero = el("div.net-hero");

  const grossLabel = el("label", { for: "sal_gross", text: "Monthly gross" });
  const grossHint = el("span.hint", {});
  const syncLabel = () => {
    const m = modeSel.value;
    grossLabel.textContent = "Monthly gross";
    grossHint.textContent = m === "monthly" ? "Whole month" : "Split · half each cutoff";
    periodSel.parentElement && (periodSel.parentElement.style.display = m === "monthly" ? "none" : "");
  };

  const recalc = () => {
    const amount = parseFloat(grossInput.value) || 0;
    const allowance = parseFloat(allowanceInput.value) || 0;
    const incentive = parseFloat(incentiveInput.value) || 0;
    const p = DB.profile();
    const r = computeSalary(amount, modeSel.value, p.customDeductions ? p.deductions : null);
    paintBreakdown(breakdown, r, allowance, incentive);
    paintNet(netHero, r, allowance, incentive);
  };
  [grossInput, allowanceInput, incentiveInput].forEach((i) => i.addEventListener("input", recalc));
  modeSel.addEventListener("change", () => { syncLabel(); recalc(); });

  const grossField = el("div.field", {}, [grossLabel, wrapAmount(grossInput), grossHint]);

  // Deductions control, right under the gross input.
  const dedRow = el("div", { style: { gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)" } }, [
    el("span.hint", { text: DB.profile().customDeductions ? "Deduction: Fixed amount" : "Deduction: Auto" }),
    el("button.btn.btn-quiet.btn-sm", { type: "button", html: `${icons.edit}<span>Edit</span>`, onClick: () => deductionsForm(ctx) }),
  ]);

  const calcCard = card("Calculator", [
    el("div.calc-grid", {}, [
      el("div.field", { style: { gridColumn: "1 / -1" } }, [el("label", { text: "Pay period" }), modeSel]),
      grossField,
      dedRow,
      field("Allowance", wrapAmount(allowanceInput), "Optional"),
      field("Incentive", wrapAmount(incentiveInput), "Optional"),
      field("Period", periodSel),
      field("Pay date", dateInput),
    ]),
    breakdown,
    el("div", { style: { marginTop: "var(--space-5)" } }, [
      el("button.btn.btn-primary", {
        type: "button", html: `${icons.plus}<span>Save</span>`,
        onClick: async () => {
          const amount = parseFloat(grossInput.value) || 0;
          if (amount <= 0) return toast("Enter your gross first", "err");
          const mode = modeSel.value;
          await DB.Salary.add({
            pay_date: dateInput.value || todayISO(),
            period: mode === "monthly" ? "Whole month" : periodSel.value,
            gross: mode === "split" ? amount / 2 : amount,
            monthly_gross: amount,
            pay_mode: mode,
            allowance: parseFloat(allowanceInput.value) || 0,
            incentive: parseFloat(incentiveInput.value) || 0,
          });
          toast("Saved");
          ctx.rerender();
        },
      }),
    ]),
  ]);
  syncLabel();

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

function deductionsForm(ctx) {
  const p = DB.profile();
  let mode = p.customDeductions ? "fixed" : "auto";

  const amt = (v) => el("input.input.num", { type: "number", step: "0.01", min: "0", inputmode: "decimal", placeholder: "0.00", value: v || "" });
  const sssIn = amt(p.deductions.sss), phIn = amt(p.deductions.philhealth), pagIn = amt(p.deductions.pagibig);

  const fixedFields = el("div", { style: { display: "grid", gap: "var(--space-4)", marginTop: "var(--space-4)" } }, [
    field("SSS", wrapAmount(sssIn)),
    field("PhilHealth", wrapAmount(phIn)),
    field("Pag-IBIG", wrapAmount(pagIn)),
    el("span.hint", { text: "Monthly totals · split mode halves them per cutoff" }),
  ]);

  const tabAuto = el("button.auth-tab", { type: "button", text: "Auto" });
  const tabFixed = el("button.auth-tab", { type: "button", text: "Fixed amount" });
  const sync = () => {
    tabAuto.classList.toggle("active", mode === "auto");
    tabFixed.classList.toggle("active", mode === "fixed");
    fixedFields.hidden = mode !== "fixed";
  };
  tabAuto.addEventListener("click", () => { mode = "auto"; sync(); });
  tabFixed.addEventListener("click", () => { mode = "fixed"; sync(); });

  const dlg = el("dialog.modal", { "aria-label": "Deductions" });
  dlg.append(
    el("div.modal-head", {}, [
      el("h3", { text: "Deduction" }),
      el("button.btn-icon.btn-quiet", { type: "button", "aria-label": "Close", html: icons.close, onClick: () => dlg.close() }),
    ]),
    el("div.modal-body", { style: { paddingBottom: "var(--space-4)" } }, [
      el("div.auth-tabs", { role: "tablist", style: { marginBottom: "0" } }, [tabAuto, tabFixed]),
      fixedFields,
    ]),
    el("div.modal-foot", {}, [
      el("button.btn.btn-ghost", { type: "button", text: "Cancel", onClick: () => dlg.close() }),
      el("button.btn.btn-primary", { type: "button", text: "Save", onClick: async () => {
        await DB.setDeductions({ custom: mode === "fixed", sss: parseFloat(sssIn.value) || 0, philhealth: parseFloat(phIn.value) || 0, pagibig: parseFloat(pagIn.value) || 0 });
        dlg.close(); toast("Deductions saved"); ctx.rerender();
      } }),
    ]),
  );
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
  sync();
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
