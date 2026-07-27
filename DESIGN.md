# Design

Visual system for Kwenta. Direction: **Warm Editorial** — a personal finance
app that reads like a well-set magazine about *your* money. Warmth comes from
the accent and the display type, never from a tinted background.

## Theme

Light, single theme. Scene: *Mark, evening, on his phone, checking where the
money went after payday — calm, unhurried, wants the truth at a glance.* Pure
white surface keeps the terracotta accent ringing like a single note.

## Color (OKLCH)

Color strategy: **Restrained + one committed warm accent** (accent ≤ ~10% of
surface). Tokens in `css/tokens.css`.

| Role | Token | Value |
|------|-------|-------|
| Background | `--bg` | `oklch(1 0 0)` — pure white |
| Surface (cards) | `--surface` | `oklch(0.985 0.004 60)` |
| Ink (body) | `--ink` | `oklch(0.22 0.012 45)` — warm near-black, ~13:1 |
| Muted text | `--muted` | `oklch(0.52 0.012 48)` |
| Hairline | `--hairline` | `oklch(0.912 0.005 60)` |
| **Accent** | `--accent` | `oklch(0.585 0.145 40)` — terracotta / clay |
| Accent (text-on-white) | `--accent-ink` | `oklch(0.46 0.135 38)` |
| Positive (money in) | `--positive` | `oklch(0.52 0.088 155)` — muted deep green |
| Categorical ramp | `--cat-1..6` | terracotta → ochre → green → petrol → plum → clay-rose |

Rules: white text on accent fills (Helmholtz-Kohlrausch); green reserved for
savings / money-in and used sparingly; terracotta doubles as money-out/debt.
No cream/beige backgrounds. Distinct from DVAC's signal red by intent.

## Typography

Contrast-axis pairing (serif + sans), not two-of-a-kind.

- **Display / headings / hero figures** — `Fraunces` (editorial serif, optical
  sizing, tabular figures). Carries the magazine character.
- **UI / body** — `Inter`.
- **Figures in tables & dense rows** — `IBM Plex Mono`, tabular-nums.

`.fig` = big Fraunces numbers (KPIs, net pay). `.num` / `.amount` = Plex Mono
tabular. Headings use `text-wrap: balance`; prose uses `text-wrap: pretty`.

## Layout & components

- Fixed left sidebar (desktop) → bottom tab bar (≤ 920px), 7 sections.
- Content max `74rem`, centered. Generous vertical rhythm from the `--space-*`
  scale.
- Cards are used where they're the right affordance (KPIs, charts, tiles); no
  nested cards. Responsive grids via `repeat(auto-fit, minmax(...))`.
- Native `<dialog>` for modals/forms (escapes stacking contexts). Toasts for
  confirmations. Progress fills animate on `transform: scaleX` (no layout
  thrash). Semantic z-index scale.

## Motion

Ease-out (`cubic-bezier(0.22,1,0.36,1)`); page/view `rise` + `fade` entrances;
subtle button press. Full `prefers-reduced-motion` kill-switch in `base.css`.

## Accessibility

WCAG AA. Focus-visible terracotta ring; tap targets ≥ 44px; charts always show
labels + values (never color-alone); currency `₱#,##0.00`.
