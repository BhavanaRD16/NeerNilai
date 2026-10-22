/**
 * NeerNilai – Shared helpers
 * Formatting, time, CSV export, numeric safety, and simulation clock.
 */

export const DEVICE_STALE_MS = 20000;

/* ------------------------------------------------------------------ */
/*  Simulation Clock (time acceleration)                              */
/* ------------------------------------------------------------------ */

const _simClock = {
    speed: 1,         // 1x, 5x, 20x, 60x
    epoch: Date.now(), // real time when speed was last set
    simEpoch: Date.now() // simulated time at that moment
};

/** Get current simulation time (respects time acceleration) */
export function simNow() {
    const realElapsed = Date.now() - _simClock.epoch;
    return _simClock.simEpoch + realElapsed * _simClock.speed;
}

/** Set simulation speed. Anchors the simulated time at the current moment. */
export function setSimSpeed(speed) {
    _simClock.simEpoch = simNow();
    _simClock.epoch = Date.now();
    _simClock.speed = speed;
}

/** Get current simulation speed */
export function getSimSpeed() {
    return _simClock.speed;
}

/** Reset sim clock to real time */
export function resetSimClock() {
    _simClock.speed = 1;
    _simClock.epoch = Date.now();
    _simClock.simEpoch = Date.now();
}

/* ------------------------------------------------------------------ */
/*  Numeric helpers                                                   */
/* ------------------------------------------------------------------ */

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

export function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                        */
/* ------------------------------------------------------------------ */

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
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
}

/* ------------------------------------------------------------------ */
/*  Device status                                                     */
/* ------------------------------------------------------------------ */

export function isDeviceOnline(device, now = Date.now()) {
    if (!device) return false;
    const lastSeen = toNumber(device.lastSeen, 0);
    return Boolean(device.online) && lastSeen > 0 && now - lastSeen <= DEVICE_STALE_MS;
}

/* ------------------------------------------------------------------ */
/*  Storage computation                                               */
/* ------------------------------------------------------------------ */

export function storageFromLevel(waterLevel, settings) {
    const maxHeight = toNumber(settings?.maxTankHeight, 15);
    const maxCapacity = toNumber(settings?.maxCapacity, 50);
    const percentage = maxHeight > 0 ? clamp((waterLevel / maxHeight) * 100, 0, 100) : 0;
    const storage = (percentage / 100) * maxCapacity;
    return { percentage, storage };
}

/* ------------------------------------------------------------------ */
/*  Scale factor conversion (prototype ↔ real dam units)              */
/* ------------------------------------------------------------------ */

/**
 * Convert prototype values to real-dam equivalents using scale factors from settings.
 * @param {object} telemetry - Current telemetry readings
 * @param {object} settings  - Dam settings with scaleFactor
 * @returns {object} Converted values in dam units
 */
export function toRealDamUnits(telemetry, settings) {
    const sf = settings?.scaleFactor || { heightFtPerCm: 1, capacityTmcPerL: 1, flowCusecsPerLpm: 1 };
    const level = toNumber(telemetry?.waterLevel, 0);
    const storage = toNumber(telemetry?.storage, 0);
    const inflow = toNumber(telemetry?.inflowRate, 0);
    const outflow = toNumber(telemetry?.outflowRate, 0);

    return {
        waterLevel: round(level * sf.heightFtPerCm, 2),
        waterLevelUnit: "ft",
        storage: round(storage * sf.capacityTmcPerL, 4),
        storageUnit: "TMC",
        inflowRate: round(inflow * sf.flowCusecsPerLpm, 1),
        outflowRate: round(outflow * sf.flowCusecsPerLpm, 1),
        flowUnit: "cusecs",
        maxHeight: round(toNumber(settings?.maxTankHeight, 15) * sf.heightFtPerCm, 1),
        maxCapacity: round(toNumber(settings?.maxCapacity, 50) * sf.capacityTmcPerL, 4)
    };
}

/* ------------------------------------------------------------------ */
/*  CSV export                                                        */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  History helpers                                                    */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  DOM helpers                                                       */
/* ------------------------------------------------------------------ */

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

/**
 * Debounce a function.
 */
export function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

/**
 * Throttle a function to at most once per `ms` milliseconds.
 */
export function throttle(fn, ms) {
    let last = 0;
    let timer;
    return (...args) => {
        const now = Date.now();
        const remaining = ms - (now - last);
        clearTimeout(timer);
        if (remaining <= 0) {
            last = now;
            fn(...args);
        } else {
            timer = setTimeout(() => {
                last = Date.now();
                fn(...args);
            }, remaining);
        }
    };
}

/**
 * Wait for a specified duration.
 */
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
