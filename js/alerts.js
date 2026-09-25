/**
 * Alert evaluation from live telemetry + settings.
 * Overflow safety writes a gate command; it does not claim the actuator moved.
 */

import {
    db,
    ref,
    set,
    update,
    PATHS
} from "./firebase.js";
import { toNumber, clamp } from "./utils.js";

const OVERFLOW_RATIO = 0.8;
const LOW_WATER_RATIO = 0.2;

let lastOverflowCommandId = 0;

export function evaluateAlerts({ telemetry, settings, deviceOnline, firebaseConnected }) {
    const alerts = [];
    const maxHeight = toNumber(settings?.maxTankHeight, 15);
    const warningLevel = toNumber(settings?.warningLevel, 12);
    const criticalLevel = toNumber(settings?.criticalLevel, 13.5);
    const overflowSafety = settings?.overflowSafety !== false;
    const level = toNumber(telemetry?.waterLevel, 0);
    const inflow = toNumber(telemetry?.inflowRate, 0);
    const outflow = toNumber(telemetry?.outflowRate, 0);
    const percentage = maxHeight > 0 ? (level / maxHeight) * 100 : 0;

    if (!firebaseConnected) {
        alerts.push({
            code: "FIREBASE_ERROR",
            title: "Firebase Connection Error",
            message: "The dashboard cannot reach Firebase Realtime Database.",
            severity: "critical"
        });
    }

    if (!deviceOnline) {
        alerts.push({
            code: "ESP32_DISCONNECTED",
            title: "ESP32 DISCONNECTED",
            message: "No fresh telemetry from ESP32_RESERVOIR_01. Start the simulator or check the device.",
            severity: "critical"
        });
    }

    if (overflowSafety && percentage >= OVERFLOW_RATIO * 100) {
        alerts.push({
            code: "OVERFLOW_SAFETY",
            title: "OVERFLOW SAFETY ACTIVE",
            message: "Water is at or above 80% of tank height. A gate-open command was issued. Physical position updates only when telemetry confirms it.",
            severity: "critical"
        });
    } else if (level >= criticalLevel) {
        alerts.push({
            code: "CRITICAL",
            title: "CRITICAL WATER LEVEL",
            message: `Water level ${level.toFixed(2)} cm exceeds the critical threshold of ${criticalLevel} cm.`,
            severity: "critical"
        });
    } else if (level >= warningLevel) {
        alerts.push({
            code: "WARNING",
            title: "WARNING WATER LEVEL",
            message: `Water level ${level.toFixed(2)} cm exceeds the warning threshold of ${warningLevel} cm.`,
            severity: "warning"
        });
    } else if (percentage > 0 && percentage <= LOW_WATER_RATIO * 100) {
        alerts.push({
            code: "LOW",
            title: "LOW WATER LEVEL – CONSERVE WATER",
            message: "Reservoir storage is low. Reduce outflow and conserve water.",
            severity: "warning"
        });
    } else if (deviceOnline && firebaseConnected) {
        alerts.push({
            code: "NORMAL",
            title: "NORMAL WATER LEVEL",
            message: "Reservoir operating within configured limits.",
            severity: "normal"
        });
    }

    if (inflow >= 8) {
        alerts.push({
            code: "HIGH_INFLOW",
            title: "HIGH INFLOW",
            message: `Inflow rate is ${inflow.toFixed(1)} L/min.`,
            severity: "warning"
        });
    }

    if (outflow >= 8) {
        alerts.push({
            code: "HIGH_OUTFLOW",
            title: "HIGH OUTFLOW",
            message: `Outflow rate is ${outflow.toFixed(1)} L/min.`,
            severity: "warning"
        });
    }

    return alerts;
}

export function waterConditionLabel(alerts) {
    const priority = ["OVERFLOW_SAFETY", "CRITICAL", "WARNING", "LOW", "ESP32_DISCONNECTED", "FIREBASE_ERROR"];
    const match = priority
        .map((code) => alerts.find((alert) => alert.code === code))
        .find(Boolean);
    if (!match) return "NORMAL";
    if (match.code === "OVERFLOW_SAFETY") return "OVERFLOW RISK";
    if (match.code === "CRITICAL") return "CRITICAL";
    if (match.code === "WARNING") return "WARNING";
    if (match.code === "LOW") return "LOW";
    if (match.code === "ESP32_DISCONNECTED") return "NO DATA";
    if (match.code === "FIREBASE_ERROR") return "OFFLINE";
    return "NORMAL";
}

export function renderAlerts(container, alerts) {
    if (!container) return;
    if (!alerts.length) {
        container.innerHTML = `
            <div class="alert-banner alert-normal">
                <i class="bi bi-check-circle-fill"></i>
                <div>
                    <strong>SYSTEM IDLE</strong>
                    <p>Waiting for telemetry and settings from Firebase.</p>
                </div>
            </div>`;
        return;
    }

    container.innerHTML = alerts.map((alert) => `
        <div class="alert-banner alert-${alert.severity}" data-code="${alert.code}">
            <i class="bi ${iconFor(alert.severity)}"></i>
            <div>
                <strong>${alert.title}</strong>
                <p>${alert.message}</p>
            </div>
        </div>
    `).join("");
}

function iconFor(severity) {
    if (severity === "critical") return "bi-exclamation-octagon-fill";
    if (severity === "warning") return "bi-exclamation-triangle-fill";
    return "bi-check-circle-fill";
}

/**
 * Persist the current alert snapshot and, if needed, send a gate-open command.
 * Command Sent ≠ physical gate confirmed.
 */
export async function publishAlertsAndOverflow(alerts, settings, telemetry, controls) {
    try {
        await set(ref(db, PATHS.alerts), {
            updatedAt: Date.now(),
            items: alerts
        });

        const overflow = alerts.some((alert) => alert.code === "OVERFLOW_SAFETY");
        const overflowSafety = settings?.overflowSafety !== false;
        const maxHeight = toNumber(settings?.maxTankHeight, 15);
        const level = toNumber(telemetry?.waterLevel, 0);
        const percentage = maxHeight > 0 ? (level / maxHeight) * 100 : 0;

        if (overflow && overflowSafety && percentage >= OVERFLOW_RATIO * 100) {
            const commandId = Date.now();
            if (commandId - lastOverflowCommandId > 8000) {
                lastOverflowCommandId = commandId;
                const currentPos = toNumber(controls?.gate?.position, 0);
                await update(ref(db, "controls/gate"), {
                    command: "OPEN_FULL",
                    step: toNumber(controls?.gate?.step, 0.25),
                    position: clamp(currentPos, 0, 1),
                    commandId
                });
            }
        } else if (percentage < OVERFLOW_RATIO * 100) {
            lastOverflowCommandId = 0;
        }
    } catch (error) {
        console.error("Failed to publish alerts / overflow command:", error);
    }
}
