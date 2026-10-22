/**
 * NeerNilai – Predictive Analytics & Net Inflow Projections
 * Calculates time-to-critical and time-to-warning based on current net accumulation rate (Inflow - Outflow).
 */

import { toNumber, round } from "./utils.js";

/**
 * Compute predictive metrics from current telemetry and dam settings
 * @param {Object} telemetry
 * @param {Object} settings
 * @returns {Object} { netFlowLpm, rateOfRiseCmMin, timeToWarningMin, timeToCriticalMin, trend }
 */
export function calculatePredictions(telemetry, settings) {
    if (!telemetry || !settings) {
        return {
            netFlowLpm: 0,
            rateOfRiseCmMin: 0,
            timeToWarningMin: null,
            timeToCriticalMin: null,
            trend: "STABLE",
            headline: "Stable reservoir equilibrium"
        };
    }

    const currentLevel = toNumber(telemetry.waterLevel, 0);
    const maxHeight = toNumber(settings.maxTankHeight, 15);
    const maxCapacity = toNumber(settings.maxCapacity, 50);
    const warningLevel = toNumber(settings.warningLevel, 12);
    const criticalLevel = toNumber(settings.criticalLevel, 13.5);

    const inflow = toNumber(telemetry.inflowRate, 0);
    const outflow = toNumber(telemetry.outflowRate, 0);
    const netFlowLpm = inflow - outflow; // Positive = rising, negative = falling

    // Volume to Height conversion factor: cm per Litre = maxHeight / maxCapacity
    const cmPerLitre = maxCapacity > 0 ? (maxHeight / maxCapacity) : 0;
    const rateOfRiseCmMin = netFlowLpm * cmPerLitre;

    let timeToWarningMin = null;
    let timeToCriticalMin = null;
    let trend = "STABLE";
    let headline = "Water balance is in equilibrium.";

    if (rateOfRiseCmMin > 0.05) {
        trend = "RISING";
        if (currentLevel < warningLevel) {
            timeToWarningMin = (warningLevel - currentLevel) / rateOfRiseCmMin;
        }
        if (currentLevel < criticalLevel) {
            timeToCriticalMin = (criticalLevel - currentLevel) / rateOfRiseCmMin;
        }

        if (timeToCriticalMin !== null && timeToCriticalMin < 10) {
            headline = `URGENT: Storage rising rapidly. Critical threshold in ~${Math.ceil(timeToCriticalMin)} min!`;
        } else if (timeToWarningMin !== null) {
            headline = `Reservoir level increasing. Warning threshold in ~${Math.ceil(timeToWarningMin)} min.`;
        } else {
            headline = "Reservoir is currently above warning limits; water rising.";
        }
    } else if (rateOfRiseCmMin < -0.05) {
        trend = "RECEDING";
        headline = `Net outflow (${Math.abs(netFlowLpm).toFixed(1)} L/min). Storage is safely receding.`;
    }

    return {
        netFlowLpm: round(netFlowLpm, 2),
        rateOfRiseCmMin: round(rateOfRiseCmMin, 3),
        timeToWarningMin: timeToWarningMin !== null ? round(timeToWarningMin, 1) : null,
        timeToCriticalMin: timeToCriticalMin !== null ? round(timeToCriticalMin, 1) : null,
        trend,
        headline
    };
}
