// Shared building blocks for views.
import { el } from "../lib/ui.js";
import { icons } from "../lib/icons.js";
import { fmtMonth } from "../lib/format.js";

export function pageHead(title, subtitle, actions = []) {
  return el("header.page-head", {}, [
    el("div.title", {}, [el("h1", { text: title }), subtitle && el("p", { text: subtitle })]),
    actions.length ? el("div.page-actions", {}, actions) : null,
  ]);
}

/** Month stepper bound to ctx.state.month (yyyy-mm). */
export function monthNav(ctx) {
  const label = el("span.label", { text: fmtMonth(ctx.state.month + "-01") });
  const step = (delta) => {
    const [y, m] = ctx.state.month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    ctx.setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  return el("div.month-nav", { role: "group", "aria-label": "Select month" }, [
    el("button.btn-icon", { type: "button", "aria-label": "Previous month", html: icons.left, onClick: () => step(-1) }),
    label,
    el("button.btn-icon", { type: "button", "aria-label": "Next month", html: icons.right, onClick: () => step(1) }),
  ]);
}

export function addButton(label, onClick) {
  return el("button.btn.btn-primary", { type: "button", onClick, html: `${icons.plus}<span>${label}</span>` });
}

export function emptyState(title, message, action) {
  return el("div.empty", {}, [
    el("div.glyph", { html: icons.spark }),
    el("h3", { text: title }),
    el("p", { text: message }),
    action || null,
  ]);
}

export function card(title, bodyChildren, headRight) {
  return el("section.card", {}, [
    title ? el("div.card-head", {}, [el("h3", { text: title }), headRight || null]) : null,
    ...[].concat(bodyChildren),
  ]);
}

export function rowActions(onEdit, onDelete) {
  return el("div.row-actions", {}, [
    onEdit && el("button.btn-icon.btn-quiet.btn-sm", { type: "button", "aria-label": "Edit", html: icons.edit, onClick: onEdit }),
    onDelete && el("button.btn-icon.btn-quiet.btn-sm", { type: "button", "aria-label": "Delete", html: icons.trash, onClick: onDelete }),
  ]);
}
