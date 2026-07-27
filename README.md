# Kwenta — Personal Finance Tracker

A warm, editorial personal finance tracker for **Mark**. Vanilla HTML/CSS/JS,
no build step. Runs on local **sample data** today; wire **Supabase** to sync
across devices; deploy free on **GitHub Pages**.

Currency **PHP (₱)**, semi-monthly pay (15th & 30th). Views: Dashboard ·
Salary · Expenses · Loans · Pautang · Savings · Calendar.

## Run it locally

It uses ES modules, so it must be served over `http://` (not opened as a
`file://`).

**VS Code (recommended):** install the **Live Server** extension (already in
`.vscode/extensions.json`), then right-click `index.html` → *Open with Live
Server*.

**Or any static server:**

```bash
python -m http.server 5601
```

Then open <http://localhost:5601>. **Create an account** (or *Explore with sample
data*). The app starts **empty** — no demo data ships to real users.

> Console helpers: `ft.loadSample()` fills the July-2026 demo data · `ft.reset()`
> wipes back to a clean account.

## Features

- **Accounts** — sign up / sign in with inline validation (local preview today;
  Supabase Auth-ready — see below). Data starts empty per account.
- **Salary → net** — 2026 PH statutory engine (SSS/PhilHealth/Pag-IBIG/BIR).
- **Expenses · Loans · Pautang · Savings · Calendar** — full CRUD, live totals,
  charts, habit tracking.
- **Export to one spreadsheet** — the *Export* button on the Dashboard downloads a
  single `.xlsx` with a tab per section (Summary, Salary, Expenses, Loans, Pautang,
  Savings, Habits). Opens directly in **Google Sheets** (File → Import) or Excel.

## Project structure

```
index.html            App shell — loads fonts, CSS, and js/app.js (module)
css/
  tokens.css          Design tokens (OKLCH colours, type, spacing, z-index)
  base.css            Reset, elements, typography, utilities, motion
  components.css      Buttons, inputs, cards, chips, tables, modal, toast
  app.css             Shell, sidebar/mobile nav, per-view layouts
js/
  config.js           Supabase keys (empty ⇒ sample mode) + app config
  app.js              Bootstrap: login, shell, hash routing, month state
  salary.js           2026 PH statutory engine (SSS/PhilHealth/Pag-IBIG/BIR)
  data.js             THE data seam — swap sample↔Supabase here only
  sampleData.js       Realistic seed data (July 2026)
  charts.js           Chart.js wrappers, themed to the palette
  lib/                format.js · icons.js · ui.js (el/toast/modal)
  views/              dashboard · salary · expenses · loans · pautang ·
                      savings · calendar · shared helpers
```

## Design

Direction: **Warm Editorial** — warmth from a terracotta accent + Fraunces
display type on a clean white surface (never a cream background). Numbers are
the hero: tabular figures everywhere money appears. See `DESIGN.md` for the
full visual system and `PRODUCT.md` for strategy.

## Wiring Supabase (next step)

1. Provision the project + tables with **RLS on every table** (`auth.uid() =
   user_id`), per `CLAUDE_CODE_BUILD_BRIEF.md`.
2. Put `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` in `config.js` (the
   publishable/anon key is safe to commit — RLS protects the data).
3. In `js/data.js`, replace the localStorage bodies of each `collection()` and
   selector with `supabase.from('table').select()/.insert()/.update()/.delete()`.
   **The views don't change** — they only call `data.js`.
4. Swap the login in `app.js` for `supabase.auth.signInWithOtp` (magic link).

## Deploy (GitHub Pages)

Push to a repo → Settings → Pages → deploy from `main`. Add the resulting
`https://<you>.github.io/<repo>` URL to Supabase Auth's redirect allowlist so
magic-link login works.
