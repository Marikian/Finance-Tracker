// Chart.js wrappers, themed to the Warm Editorial palette.
import Chart from "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/auto/+esm";
import { money, moneyK } from "./lib/format.js";

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const CAT_COLORS = () => ["--cat-1", "--cat-2", "--cat-3", "--cat-4", "--cat-5", "--cat-6"].map(css);

const FONT = { family: "IBM Plex Mono, monospace", size: 11 };
const registry = new Map(); // canvas -> Chart, so re-renders don't leak

function mount(canvas, config) {
  registry.get(canvas)?.destroy();
  const chart = new Chart(canvas, config);
  registry.set(canvas, chart);
  return chart;
}

/** Tear down all charts before a view re-render so detached canvases don't leak. */
export function destroyAll() {
  registry.forEach((c) => c.destroy());
  registry.clear();
}

const gridColor = () => css("--hairline");
const inkColor = () => css("--ink");
const mutedColor = () => css("--muted");

const tooltip = {
  backgroundColor: () => inkColor(),
  padding: 10, cornerRadius: 8, displayColors: true, boxPadding: 4,
  titleFont: { family: "Inter", weight: "600", size: 12 },
  bodyFont: FONT,
  callbacks: { label: (c) => "  " + money(c.parsed.y ?? c.parsed ?? c.raw) },
};

export function donut(canvas, { labels, values }) {
  return mount(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values, backgroundColor: CAT_COLORS(), borderWidth: 2,
        borderColor: css("--surface"), hoverOffset: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "66%",
      plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => "  " + money(c.parsed) } } },
    },
  });
}

export function bars(canvas, { labels, values, highlightIndex = -1, horizontal = false, color }) {
  const base = color || css("--cat-4");
  const bg = values.map((_, i) => (i === highlightIndex ? css("--accent") : base));
  return mount(canvas, {
    type: "bar",
    data: { labels, datasets: [{ data: values, backgroundColor: bg, borderRadius: 6, maxBarThickness: 34 }] },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip },
      scales: {
        x: {
          grid: { display: horizontal, color: gridColor(), drawTicks: false },
          border: { display: false },
          ticks: { color: mutedColor(), font: FONT, callback: horizontal ? (v) => moneyK(v) : undefined },
        },
        y: {
          grid: { display: !horizontal, color: gridColor(), drawTicks: false },
          border: { display: false },
          ticks: { color: mutedColor(), font: FONT, callback: horizontal ? undefined : (v) => moneyK(v) },
        },
      },
    },
  });
}

export function line(canvas, { labels, values, label = "" }) {
  const accent = css("--accent");
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height || 240);
  grad.addColorStop(0, css("--accent-wash"));
  grad.addColorStop(1, "transparent");
  return mount(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: values, label, borderColor: accent, backgroundColor: grad,
        fill: true, tension: 0.35, borderWidth: 2.5,
        pointRadius: 3, pointBackgroundColor: accent, pointBorderColor: css("--bg"), pointBorderWidth: 2,
        pointHoverRadius: 5,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: mutedColor(), font: FONT } },
        y: { grid: { color: gridColor(), drawTicks: false }, border: { display: false },
             ticks: { color: mutedColor(), font: FONT, callback: (v) => moneyK(v) } },
      },
    },
  });
}
