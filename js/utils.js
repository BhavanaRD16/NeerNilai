/**
 * Shared helpers for formatting, time, CSV export, and numeric safety.
 */

export const DEVICE_STALE_MS = 20000;

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

export function round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round(toNumber(value) * factor) / factor;
}

export function formatNumber(value, digits = 2, unit = "") {
    const text = round(value, digits).toFixed(digits);
    return unit ? `${text} ${unit}` : text;
}

export function formatPercent(value, digits = 1) {
    return `${round(value, digits).toFixed(digits)}%`;
}

export function formatTimestamp(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-IN", {
        hour12: false,
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

export function formatClock(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString("en-IN", { hour12: false });
}

export function relativeTime(timestamp, now = Date.now()) {
    const ts = toNumber(timestamp, 0);
    if (!ts) return "No telemetry yet";
    const delta = Math.max(0, now - ts);
    const seconds = Math.floor(delta / 1000);
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

export function isDeviceOnline(device, now = Date.now()) {
    if (!device) return false;
    const lastSeen = toNumber(device.lastSeen, 0);
    return Boolean(device.online) && lastSeen > 0 && now - lastSeen <= DEVICE_STALE_MS;
}

export function storageFromLevel(waterLevel, settings) {
    const maxHeight = toNumber(settings?.maxTankHeight, 15);
    const maxCapacity = toNumber(settings?.maxCapacity, 50);
    const percentage = maxHeight > 0 ? clamp((waterLevel / maxHeight) * 100, 0, 100) : 0;
    const storage = (percentage / 100) * maxCapacity;
    return { percentage, storage };
}

export function downloadCsv(filename, headers, rows) {
    const escape = (cell) => {
        const text = String(cell ?? "");
        if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
        return text;
    };
    const lines = [
        headers.map(escape).join(","),
        ...rows.map((row) => row.map(escape).join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export function historyToArray(historyObject) {
    if (!historyObject) return [];
    return Object.entries(historyObject)
        .map(([key, value]) => ({
            key,
            ...value,
            timestamp: toNumber(value?.timestamp, toNumber(key, 0))
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
}

export function filterHistoryByRange(rows, hours) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return rows.filter((row) => row.timestamp >= cutoff);
}

export function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

export function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

export function toggleClass(id, className, on) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle(className, on);
}
