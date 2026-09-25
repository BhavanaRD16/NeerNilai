/**
 * Chart.js real-time telemetry plots (last 30 samples + storage history).
 */

import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Filler,
    Legend,
    Tooltip
} from "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm";
import { formatClock, round } from "./utils.js";

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Filler,
    Legend,
    Tooltip
);

const gridColor = "rgba(148, 163, 184, 0.12)";
const tickColor = "#94a3b8";

function baseOptions(yTitle) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 280 },
        interaction: { mode: "index", intersect: false },
        plugins: {
            legend: {
                labels: { color: "#e2e8f0", boxWidth: 12, font: { size: 12 } }
            },
            tooltip: {
                backgroundColor: "rgba(8, 18, 34, 0.94)",
                borderColor: "rgba(45, 212, 191, 0.35)",
                borderWidth: 1
            }
        },
        scales: {
            x: {
                ticks: { color: tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                grid: { color: gridColor },
                title: { display: true, text: "Time", color: "#cbd5e1" }
            },
            y: {
                ticks: { color: tickColor },
                grid: { color: gridColor },
                title: { display: true, text: yTitle, color: "#cbd5e1" }
            }
        }
    };
}

function makeLineChart(canvas, datasets, yTitle) {
    return new Chart(canvas, {
        type: "line",
        data: { labels: [], datasets },
        options: baseOptions(yTitle)
    });
}

export function createTelemetryCharts(multiCanvas, storageCanvas) {
    const multiChart = makeLineChart(multiCanvas, [
        {
            label: "Water Level (cm)",
            data: [],
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.12)",
            tension: 0.3,
            fill: true,
            pointRadius: 0,
            borderWidth: 2
        },
        {
            label: "Inflow (L/min)",
            data: [],
            borderColor: "#2dd4bf",
            backgroundColor: "transparent",
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        },
        {
            label: "Outflow (L/min)",
            data: [],
            borderColor: "#f59e0b",
            backgroundColor: "transparent",
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        }
    ], "Value");

    const storageChart = makeLineChart(storageCanvas, [
        {
            label: "Storage (L)",
            data: [],
            borderColor: "#22d3ee",
            backgroundColor: "rgba(34, 211, 238, 0.14)",
            tension: 0.35,
            fill: true,
            pointRadius: 0,
            borderWidth: 2
        }
    ], "Litres");

    return { multiChart, storageChart };
}

export function updateCharts(charts, historyRows) {
    const slice = historyRows.slice(-30);
    const labels = slice.map((row) => formatClock(row.timestamp));

    charts.multiChart.data.labels = labels;
    charts.multiChart.data.datasets[0].data = slice.map((row) => round(row.waterLevel, 2));
    charts.multiChart.data.datasets[1].data = slice.map((row) => round(row.inflowRate, 2));
    charts.multiChart.data.datasets[2].data = slice.map((row) => round(row.outflowRate, 2));
    charts.multiChart.update("none");

    charts.storageChart.data.labels = labels;
    charts.storageChart.data.datasets[0].data = slice.map((row) => round(row.storage, 2));
    charts.storageChart.update("none");
}
