// ============================================================
// App bootstrap — auth screen, shell, routing, month state.
// ============================================================
import { el, toast } from "./lib/ui.js";
import { icons } from "./lib/icons.js";
import { initials, monthKey, todayISO } from "./lib/format.js";
import { USING_SUPABASE } from "./config.js";
import * as DB from "./data.js";
import * as Auth from "./auth.js";
import { destroyAll } from "./charts.js";

import * as dashboard from "./views/dashboard.js";
import * as salary from "./views/salary.js";
import * as expenses from "./views/expenses.js";
import * as loans from "./views/loans.js";
import * as pautang from "./views/pautang.js";
import * as savings from "./views/savings.js";
import * as calendar from "./views/calendar.js";

const VIEWS = [dashboard, salary, expenses, loans, pautang, savings, calendar];
const byId = Object.fromEntries(VIEWS.map((v) => [v.meta.id, v]));
const app = document.getElementById("app");

const state = { month: DB.monthsWithData()[0] || monthKey(todayISO()), view: "dashboard" };

const ctx = {
  state,
  setMonth(m) { state.month = m; renderView(); },
  rerender() { renderView(); },
  go(id) { location.hash = `#/${id}`; },
};

function brandMark(sub = true) {
  return el("div.brand", {}, [
    el("div.mark", { text: "₱" }),
    el("div", {}, [el("div.name", { text: "Kwenta" }), sub ? el("div.sub", { text: "personal finance" }) : null]),
  ]);
}

// ---------- Auth screen ----------
function renderAuth(mode = "signin") {
  app.innerHTML = "";
  document.body.dataset.screen = "auth";
  const isUp = mode === "signup";

  const err = el("div.form-error", { role: "alert", "aria-live": "assertive", hidden: true });
  const nameInput = el("input.input", { id: "au_name", type: "text", autocomplete: "name", placeholder: "Your name" });
  const emailInput = el("input.input", { id: "au_email", type: "email", autocomplete: "email", placeholder: "you@email.com" });
  const passInput = el("input.input", { id: "au_pass", type: "password", autocomplete: isUp ? "new-password" : "current-password", placeholder: isUp ? "At least 8 characters" : "Your password" });
  const submit = el("button.btn.btn-primary", { type: "submit", style: { width: "100%", marginTop: "var(--space-1)" }, html: `${isUp ? icons.spark : icons.mail}<span>${isUp ? "Create account" : "Sign in"}</span>` });

  const fail = (msg) => { err.textContent = msg; err.hidden = false; };

  const form = el("form", { novalidate: true, onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true; submit.disabled = true;
    try {
      const user = isUp
        ? await Auth.signUp({ name: nameInput.value, email: emailInput.value, password: passInput.value })
        : await Auth.signIn({ email: emailInput.value, password: passInput.value });
      await DB.sync();
      toast(isUp ? "Account created" : "Signed in");
      await renderApp(user);
    } catch (ex) {
      submit.disabled = false;
      if (ex.pending) { toast(ex.message, "ok"); renderAuth("signin"); return; }
      fail(ex.message); (isUp && !nameInput.value ? nameInput : emailInput).focus();
    }
  } }, [
    isUp ? field("Name", nameInput) : null,
    field("Email", emailInput),
    field("Password", passInput, isUp ? "At least 8 characters." : null),
    err,
    submit,
  ]);

  const card = el("div.login-card.rise", {}, [
    brandMark(),
    el("h1", { text: isUp ? "Create your account" : "Welcome back" }),
    el("p.lede", { text: isUp ? "Track your money, privately." : "Sign in to see your money." }),
    el("div.auth-tabs", { role: "tablist" }, [
      tab("Sign in", !isUp, () => renderAuth("signin")),
      tab("Create account", isUp, () => renderAuth("signup")),
    ]),
    form,
    USING_SUPABASE ? null : el("button.btn.btn-quiet.demo-link", { type: "button", text: "Explore with sample data", onClick: async () => {
      DB.loadSample();
      await Auth.signIn({ email: "demo@kwenta.app", password: "demodemo" });
      await DB.sync(); toast("Loaded sample data"); await renderApp();
    } }),
    el("p.login-note", { text: USING_SUPABASE
      ? "Secured by Supabase Auth. Every account's data is isolated with row-level security."
      : "Preview mode — data stays in this browser. Connect Supabase for real, synced accounts." }),
  ]);

  app.append(el("div.login", {}, [card]));
  setTimeout(() => (isUp ? nameInput : emailInput).focus(), 60);
}

function tab(label, active, onClick) {
  return el(`button.auth-tab${active ? ".active" : ""}`, { type: "button", role: "tab", "aria-selected": active ? "true" : "false", text: label, onClick });
}
function field(label, input, hint) {
  return el("div.field", {}, [el("label", { for: input.id, text: label }), input, hint ? el("span.hint", { text: hint }) : null]);
}

// ---------- App shell ----------
let contentRoot;

async function renderApp(user) {
  if (!user) user = (await Auth.getUser()) || { name: DB.profile().name, email: DB.profile().email };
  // Prefer the freshly synced month with data.
  state.month = DB.monthsWithData()[0] || monthKey(todayISO());
  app.innerHTML = "";
  document.body.dataset.screen = "app";

  const nav = el("nav.nav", { "aria-label": "Sections" }, VIEWS.map((v) =>
    el("a", { href: `#/${v.meta.id}`, dataset: { view: v.meta.id }, html: `${v.meta.icon}<span class="label">${v.meta.label}</span>` })));

  const sidebar = el("aside.sidebar", {}, [
    brandMark(),
    nav,
    el("div.nav-spacer"),
    el("div.sidebar-foot", {}, [
      el("div.user-row", {}, [
        el("div.avatar", { text: initials(user.name || user.email) || "₱" }),
        el("div.grow", { style: { minWidth: 0 } }, [
          el("div", { style: { fontWeight: "600", fontSize: "var(--text-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, text: user.name || "Your account" }),
          el("div.faint", { style: { fontSize: "var(--text-xs)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, text: user.email || "" }),
        ]),
        el("button.btn-icon.btn-quiet", { type: "button", "aria-label": "Sign out", title: "Sign out", html: icons.logout, onClick: signOut }),
      ]),
    ]),
  ]);

  const topbar = el("header.topbar", {}, [
    brandMark(false),
    el("button.btn-icon.btn-quiet", { type: "button", "aria-label": "Sign out", html: icons.logout, onClick: signOut }),
  ]);

  contentRoot = el("div.content");
  app.append(sidebar, el("main.main", {}, [topbar, contentRoot]));
  routeFromHash();
}

async function signOut() {
  await Auth.signOut();
  location.hash = "";
  renderAuth("signin");
}

// ---------- Routing ----------
function routeFromHash() {
  const id = location.hash.replace(/^#\/?/, "") || "dashboard";
  state.view = byId[id] ? id : "dashboard";
  renderView();
}
function updateActiveNav() {
  document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.view === state.view));
}
function renderView() {
  if (!contentRoot) return;
  destroyAll();
  contentRoot.innerHTML = "";
  const view = el("div.view.rise");
  contentRoot.append(view);
  byId[state.view].render(view, ctx);
  window.scrollTo({ top: 0, behavior: "auto" });
  updateActiveNav();
}
window.addEventListener("hashchange", routeFromHash);

// ---------- Start ----------
(async function start() {
  try {
    const user = await Auth.getUser();
    if (user) { await DB.sync(); await renderApp(user); }
    else renderAuth("signin");
  } catch { renderAuth("signin"); }
})();

// Console helpers (preview mode only).
window.ft = {
  reset: () => { DB.resetData(); location.reload(); },
  loadSample: () => { DB.loadSample(); location.reload(); },
};
