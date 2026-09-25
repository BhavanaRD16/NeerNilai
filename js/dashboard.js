/**
 * Main monitoring dashboard – live Firebase listeners, no page refresh required.
 */

import {
    db,
    ref,
    onValue,
    query,
    orderByKey,
    limitToLast,
    ensureDefaults,
    PATHS
} from "./firebase.js";
import {
    formatNumber,
    formatPercent,
    formatTimestamp,
    relativeTime,
    isDeviceOnline,
    toNumber,
    round,
    setText,
    downloadCsv,
    historyToArray,
    filterHistoryByRange
} from "./utils.js";
import { evaluateAlerts, renderAlerts, waterConditionLabel, publishAlertsAndOverflow } from "./alerts.js";
import { createTelemetryCharts, updateCharts } from "./charts.js";
import { initAuth, getSelectedDam, getCurrentUser, ROLES } from "./auth.js";
import { setupAuthUi } from "./authUi.js";

const HISTORY_LIMIT = 500;
const state = {
    firebaseConnected: false,
    device: null,
    telemetry: null,
    settings: null,
    controls: null,
    history: [],
    rangeHours: 1
};

let charts = null;
let clockTimer = null;

function badge(on, onLabel, offLabel) {
    return `<span class="status-pill ${on ? "pill-on" : "pill-off"}">${on ? onLabel : offLabel}</span>`;
}

function updateConnectionUi() {
    const user = getCurrentUser();
    const online = isDeviceOnline(state.device) && state.firebaseConnected;
    const isAuthorized = user.role !== ROLES.GENERAL;

    // Show/hide the two panels
    document.getElementById("nnTechStatusPanel")?.classList.toggle("d-none", !isAuthorized);
    document.getElementById("nnPublicStatusPanel")?.classList.toggle("d-none", isAuthorized);

    if (isAuthorized) {
        // --- Full technical view for Supervisors & Super Admin ---
        const statusEl = document.getElementById("esp32Status");
        const firebaseEl = document.getElementById("firebaseStatus");
        const firebaseBanner = document.getElementById("firebaseErrorBanner");

        if (statusEl) {
            statusEl.textContent = online ? "ONLINE" : "OFFLINE";
            statusEl.className = `device-state ${online ? "is-online" : "is-offline"}`;
        }
        setText("deviceId", state.device?.id || "ESP32_RESERVOIR_01");
        setText("lastUpdate", relativeTime(state.device?.lastSeen || state.telemetry?.timestamp));
        setText("lastUpdateExact", state.telemetry?.timestamp ? formatTimestamp(state.telemetry.timestamp) : "Waiting for data");
        if (firebaseEl) {
            firebaseEl.textContent = state.firebaseConnected ? "CONNECTED" : "ERROR";
            firebaseEl.className = `status-pill ${state.firebaseConnected ? "pill-on" : "pill-off"}`;
        }
        if (firebaseBanner) {
            firebaseBanner.classList.toggle("d-none", state.firebaseConnected);
        }
        setText("statusEsp32", online ? "ONLINE" : "OFFLINE");
        setText("statusFirebase", state.firebaseConnected ? "CONNECTED" : "ERROR");
    } else {
        // --- Clean public view: only last-updated timestamp ---
        const ts = state.telemetry?.timestamp || state.device?.lastSeen || 0;
        if (ts) {
            setText("publicLastUpdateDisplay", formatTimestamp(ts));
            setText("publicLastUpdateRelative", relativeTime(ts));
        } else {
            setText("publicLastUpdateDisplay", "—");
            setText("publicLastUpdateRelative", "No data received yet");
        }
    }
}

function updateMetrics() {
    const t = state.telemetry || {};
    setText("metricLevel", formatNumber(t.waterLevel, 1, "cm"));
    setText("metricPercent", formatPercent(t.waterPercentage, 0));
    setText("metricStorage", formatNumber(t.storage, 1, "L"));
    setText("metricInflow", formatNumber(t.inflowRate, 1, "L/min"));
    setText("metricOutflow", formatNumber(t.outflowRate, 1, "L/min"));
    setText("metricGate", formatPercent(toNumber(t.gatePosition, 0) * 100, 0));

    const pct = clampPercent(t.waterPercentage);
    const water = document.getElementById("tankWater");
    const readout = document.getElementById("tankReadout");
    if (water) water.style.height = `${pct}%`;
    if (readout) {
        readout.innerHTML = `<strong>${formatNumber(t.waterLevel, 1)} cm</strong><span>${formatPercent(t.waterPercentage, 0)}</span>`;
    }
}

function clampPercent(value) {
    const n = toNumber(value, 0);
    return Math.max(0, Math.min(100, n));
}

function updateStatusPanel(alerts) {
    const t = state.telemetry || {};
    setText("statusWater", waterConditionLabel(alerts));
    const pumpOn = String(t.pumpStatus || "").toUpperCase() === "ON";
    const solenoidOpen = String(t.solenoidStatus || "").toUpperCase() === "OPEN";
    setText("statusPump", pumpOn ? "ON" : "OFF");
    setText("statusSolenoid", solenoidOpen ? "OPEN" : "CLOSED");
    setText("statusGate", `${round(toNumber(t.gatePosition, 0) * 100, 0)}% OPEN`);

    document.getElementById("statusPump")?.classList.toggle("text-teal", pumpOn);
    document.getElementById("statusSolenoid")?.classList.toggle("text-teal", solenoidOpen);
}

function updateSettingsSummary() {
    const s = state.settings || {};
    setText("setMaxHeight", formatNumber(s.maxTankHeight, 1, "cm"));
    setText("setMaxCapacity", formatNumber(s.maxCapacity, 1, "L"));
    setText("setWarning", formatNumber(s.warningLevel, 1, "cm"));
    setText("setCritical", formatNumber(s.criticalLevel, 1, "cm"));
    setText("setOverflow", s.overflowSafety === false ? "DISABLED" : "ENABLED");
}

function refreshAlerts() {
    const user = getCurrentUser();
    const isAuthorized = user.role !== ROLES.GENERAL;
    const allAlerts = evaluateAlerts({
        telemetry: state.telemetry,
        settings: state.settings,
        deviceOnline: isDeviceOnline(state.device) && state.firebaseConnected,
        firebaseConnected: state.firebaseConnected
    });

    if (isAuthorized) {
        // Authorized users see every alert including system/technical ones
        renderAlerts(document.getElementById("alertSection"), allAlerts);
    } else {
        // General public: filter out system-level alerts (ESP32, Firebase, connection codes)
        const SYSTEM_ALERT_CODES = ["ESP32_DISCONNECTED", "FIREBASE_ERROR"];
        const publicAlerts = allAlerts.filter((a) => !SYSTEM_ALERT_CODES.includes(a.code));
        // Render water-condition alerts in the public section only
        renderPublicAlerts(document.getElementById("publicAlertSection"), publicAlerts);
    }

    updateStatusPanel(allAlerts);
    publishAlertsAndOverflow(allAlerts, state.settings, state.telemetry, state.controls);
}

/**
 * Render public-safe alerts. Same styling but with user-friendly language.
 */
function renderPublicAlerts(container, alerts) {
    if (!container) return;
    const waterAlerts = alerts.filter((a) => ["OVERFLOW_SAFETY", "CRITICAL", "WARNING", "LOW", "HIGH_INFLOW", "HIGH_OUTFLOW", "NORMAL"].includes(a.code));
    if (!waterAlerts.length) {
        // If we have last-known telemetry, show it with a "last known" note
        const t = state.telemetry;
        if (t && t.waterLevel !== undefined) {
            const pct = state.settings?.maxTankHeight
                ? Math.min(100, ((t.waterLevel / state.settings.maxTankHeight) * 100)).toFixed(0)
                : "—";
            container.innerHTML = `
                <div class="alert-banner alert-normal">
                    <i class="bi bi-droplet-half"></i>
                    <div>
                        <strong>RESERVOIR LEVELS NORMAL</strong>
                        <p>Last recorded water level: <strong>${(+t.waterLevel).toFixed(1)} cm</strong> (${pct}% capacity). All readings are within safe operating limits.</p>
                    </div>
                </div>`;
        } else {
            container.innerHTML = `
                <div class="alert-banner alert-normal">
                    <i class="bi bi-check-circle-fill"></i>
                    <div>
                        <strong>NORMAL CONDITIONS</strong>
                        <p>The reservoir is operating within safe levels.</p>
                    </div>
                </div>`;
        }
        return;
    }
    container.innerHTML = waterAlerts.map((alert) => {
        // Rewrite technical messages for general public
        let publicMsg = alert.message;
        if (alert.code === "OVERFLOW_SAFETY") publicMsg = "Water is approaching maximum safe capacity. Outflow management is in progress.";
        if (alert.code === "CRITICAL") publicMsg = `Water level is very high (${(state.telemetry?.waterLevel || 0).toFixed(1)} cm). Authorities are managing the situation.`;
        if (alert.code === "LOW") publicMsg = "Reservoir storage is currently low. Please conserve water.";
        return `
        <div class="alert-banner alert-${alert.severity}">
            <i class="bi ${alert.severity === 'critical' ? 'bi-exclamation-octagon-fill' : alert.severity === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'}"></i>
            <div><strong>${alert.title}</strong><p>${publicMsg}</p></div>
        </div>`;
    }).join("");
}

function renderHistoryTable() {
    const filtered = filterHistoryByRange(state.history, state.rangeHours).slice().reverse();
    const body = document.getElementById("historyBody");
    if (!body) return;

    if (!filtered.length) {
        body.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No telemetry in this time range. Start the simulator to generate data.</td></tr>`;
        setText("historyCount", "0 records");
        return;
    }

    body.innerHTML = filtered.slice(0, 80).map((row) => `
        <tr>
            <td>${formatTimestamp(row.timestamp)}</td>
            <td>${round(row.waterLevel, 2)}</td>
            <td>${round(row.waterPercentage, 1)}</td>
            <td>${round(row.storage, 2)}</td>
            <td>${round(row.inflowRate, 2)}</td>
            <td>${round(row.outflowRate, 2)}</td>
            <td>${round(toNumber(row.gatePosition, 0) * 100, 0)}%</td>
        </tr>
    `).join("");
    setText("historyCount", `${filtered.length} record${filtered.length === 1 ? "" : "s"}`);
}

function exportCsv() {
    const filtered = filterHistoryByRange(state.history, state.rangeHours);
    downloadCsv(
        `neernilai-history-${state.rangeHours}h.csv`,
        ["Timestamp", "Water Level (cm)", "Water %", "Storage (L)", "Inflow (L/min)", "Outflow (L/min)", "Gate Position"],
        filtered.map((row) => [
            formatTimestamp(row.timestamp),
            round(row.waterLevel, 2),
            round(row.waterPercentage, 1),
            round(row.storage, 2),
            round(row.inflowRate, 2),
            round(row.outflowRate, 2),
            round(toNumber(row.gatePosition, 0), 3)
        ])
    );
}

function bindHistoryControls() {
    document.querySelectorAll("[data-range]").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("[data-range]").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            state.rangeHours = Number(btn.dataset.range);
            renderHistoryTable();
        });
    });
    document.getElementById("downloadCsv")?.addEventListener("click", exportCsv);
}

function subscribe() {
    onValue(ref(db, PATHS.connected), (snap) => {
        state.firebaseConnected = snap.val() === true;
        updateConnectionUi();
        refreshAlerts();
    }, (error) => {
        console.error("Firebase connection listener failed:", error);
        state.firebaseConnected = false;
        updateConnectionUi();
        refreshAlerts();
    });

    onValue(ref(db, PATHS.device), (snap) => {
        state.device = snap.val();
        updateConnectionUi();
        refreshAlerts();
    }, (error) => console.error("device listener failed:", error));

    onValue(ref(db, PATHS.telemetryCurrent), (snap) => {
        state.telemetry = snap.val();
        updateMetrics();
        updateConnectionUi();
        refreshAlerts();
    }, (error) => console.error("telemetry/current listener failed:", error));

    onValue(ref(db, PATHS.settings), (snap) => {
        state.settings = snap.val();
        updateSettingsSummary();
        refreshAlerts();
    }, (error) => console.error("settings listener failed:", error));

    onValue(ref(db, PATHS.controls), (snap) => {
        state.controls = snap.val();
    }, (error) => console.error("controls listener failed:", error));

    const historyQuery = query(ref(db, PATHS.telemetryHistory), orderByKey(), limitToLast(HISTORY_LIMIT));
    onValue(historyQuery, (snap) => {
        state.history = historyToArray(snap.val());
        if (charts) updateCharts(charts, state.history);
        renderHistoryTable();
    }, (error) => console.error("telemetry/history listener failed:", error));
}

async function init() {
    await initAuth();
    setupAuthUi();

    charts = createTelemetryCharts(
        document.getElementById("chartMulti"),
        document.getElementById("chartStorage")
    );
    bindHistoryControls();

    try {
        await ensureDefaults();
    } catch (error) {
        console.error("Firebase initialization error:", error);
        state.firebaseConnected = false;
        document.getElementById("firebaseErrorBanner")?.classList.remove("d-none");
        refreshAlerts();
    }

    subscribe();
    clockTimer = setInterval(updateConnectionUi, 1000);
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("beforeunload", () => clearInterval(clockTimer));
