// Reusable UI primitives — element builder, toast, modal, confirm.
import { icons } from "./icons.js";

/** Tiny hyperscript: el("div.card", {onClick}, [children]) */
export function el(spec, props = {}, children = []) {
  const [tag, ...classes] = spec.split(".");
  const node = document.createElement(tag || "div");
  if (classes.length) node.className = classes.join(" ");
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

// --- Toast ---
let toastWrap;
export function toast(message, kind = "ok") {
  if (!toastWrap) {
    toastWrap = el("div.toast-wrap", { role: "status", "aria-live": "polite" });
    document.body.append(toastWrap);
  }
  const t = el(`div.toast.${kind}`, {}, [el("span.dot"), message]);
  toastWrap.append(t);
  setTimeout(() => {
    t.style.transition = "opacity .25s, transform .25s";
    t.style.opacity = "0";
    t.style.transform = "translateY(6px)";
    setTimeout(() => t.remove(), 260);
  }, 2600);
}

/**
 * Open a modal built from a form spec.
 * fields: [{name,label,type,options?,value?,required?,span?,hint?,step?,attrs?}]
 * onSubmit(values) — return falsy or nothing to close; throw to keep open.
 */
export function openForm({ title, fields, submitLabel = "Save", values = {}, onSubmit }) {
  const dlg = el("dialog.modal", { "aria-label": title });
  const form = el("form", { novalidate: true });

  const grid = el("div.form-grid");
  const inputs = {};
  for (const f of fields) {
    const id = `f_${f.name}`;
    const wrap = el(`div.field${f.span === 2 ? ".span-2" : ""}`);
    wrap.append(el("label", { for: id, text: f.label }));

    let input;
    const start = values[f.name] ?? f.value ?? "";
    if (f.type === "select") {
      input = el("select.select", { id, name: f.name });
      for (const opt of f.options) {
        const o = typeof opt === "string" ? { value: opt, label: opt } : opt;
        input.append(el("option", { value: o.value, ...(String(o.value) === String(start) ? { selected: true } : {}), text: o.label }));
      }
    } else if (f.type === "textarea") {
      input = el("textarea.textarea", { id, name: f.name, rows: 3 });
      input.value = start;
    } else if (f.type === "amount") {
      const group = el("div.input-group", {}, [el("span.prefix", { text: "₱" })]);
      input = el("input.input", { id, name: f.name, type: "number", step: "0.01", min: "0", inputmode: "decimal", placeholder: "0.00" });
      input.value = start;
      group.append(input);
      wrap.append(group);
      if (f.hint) wrap.append(el("span.hint", { text: f.hint }));
      inputs[f.name] = input;
      grid.append(wrap);
      continue;
    } else {
      input = el("input.input", { id, name: f.name, type: f.type || "text", ...(f.attrs || {}) });
      input.value = start;
    }
    if (f.required) input.required = true;
    wrap.append(input);
    if (f.hint) wrap.append(el("span.hint", { text: f.hint }));
    inputs[f.name] = input;
    grid.append(wrap);
  }

  const head = el("div.modal-head", {}, [
    el("h3", { text: title }),
    el("button.btn-icon.btn-quiet", { type: "button", "aria-label": "Close", html: icons.close, onClick: () => dlg.close() }),
  ]);
  const foot = el("div.modal-foot", {}, [
    el("button.btn.btn-ghost", { type: "button", text: "Cancel", onClick: () => dlg.close() }),
    el("button.btn.btn-primary", { type: "submit", text: submitLabel }),
  ]);

  form.append(el("div.modal-body", {}, [grid]), foot);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const out = {};
    for (const [k, node] of Object.entries(inputs)) out[k] = node.value.trim ? node.value.trim() : node.value;
    for (const f of fields) {
      if (f.required && !out[f.name]) { inputs[f.name].focus(); toast("Please fill in " + f.label, "err"); return; }
    }
    try {
      await onSubmit(out);
      dlg.close();
    } catch (err) {
      toast(err.message || "Something went wrong", "err");
    }
  });

  dlg.append(head, form);
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
  setTimeout(() => form.querySelector("input,select,textarea")?.focus(), 40);
  return dlg;
}

/** Simple confirm dialog. Returns a Promise<boolean>. */
export function confirmDialog({ title, message, confirmLabel = "Delete", danger = true }) {
  return new Promise((resolve) => {
    const dlg = el("dialog.modal", { "aria-label": title });
    let decided = false;
    dlg.append(
      el("div.modal-head", {}, [el("h3", { text: title })]),
      el("div.modal-body", {}, [el("p.muted", { text: message })]),
      el("div.modal-foot", {}, [
        el("button.btn.btn-ghost", { type: "button", text: "Cancel", onClick: () => dlg.close() }),
        el(`button.btn.${danger ? "btn-primary" : "btn-primary"}`, {
          type: "button", text: confirmLabel,
          onClick: () => { decided = true; dlg.close(); resolve(true); },
        }),
      ]),
    );
    document.body.append(dlg);
    dlg.addEventListener("close", () => { dlg.remove(); if (!decided) resolve(false); });
    dlg.showModal();
  });
}
