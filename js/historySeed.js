/**
 * NeerNilai – 24-Hour Telemetry Pre-Seeding
 * Populates realistic diurnal historical data (24 hours back) if history is empty
 * or upon supervisor request, giving reviewers rich charts immediately.
 */

import { db, ref, get, set, damPath, SUB } from "./firebase.js";
import { storageFromLevel, round } from "./utils.js";

/**
 * Check if history exists for given dam. If empty or requested, generate 24h of data.
 * @param {string} damId
 * @param {Object} settings
 * @param {boolean} [force=false]
 */
export async function seedHistoryIfEmpty(damId = "mettur", settings = {}, force = false) {
    try {
        const historyRef = ref(db, damPath(damId, SUB.telemetryHistory));
        if (!force) {
            const snap = await get(historyRef);
            if (snap.exists() && Object.keys(snap.val() || {}).length >= 10) {
                // Already has sufficient history
                return { seeded: false, count: Object.keys(snap.val()).length };
            }
        }

        console.log(`[HistorySeed] Generating 24-hour diurnal telemetry history for dam: ${damId}…`);
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const intervalMs = 15 * 60 * 1000; // Sample every 15 minutes = 96 data points
        const points = Math.floor(oneDayMs / intervalMs);

        const maxHeight = Number(settings.maxTankHeight) || 15;
        const baseLevel = maxHeight * 0.52; // ~52% nominal height
        const updates = {};

        for (let i = points; i >= 0; i--) {
            const timestamp = now - (i * intervalMs);
            const hour = (new Date(timestamp)).getHours();

            // Diurnal cycle: morning irrigation consumption, afternoon heat/irrigation, midnight base level
            const diurnal = Math.sin((hour - 6) / 24 * Math.PI * 2) * 1.2;
            
            // Mid-day rain event simulation 8 hours ago
            const hoursAgo = (now - timestamp) / (60 * 60 * 1000);
            let rainSpike = 0;
            if (hoursAgo >= 7 && hoursAgo <= 11) {
                rainSpike = Math.sin((hoursAgo - 7) / 4 * Math.PI) * 2.8;
            }

            const level = Math.max(1.0, Math.min(maxHeight * 0.95, baseLevel + diurnal + rainSpike + (Math.random() - 0.5) * 0.2));
            const { percentage, storage } = storageFromLevel(level, settings);

            const pumpOn = hour >= 6 && hour <= 9 || hour >= 17 && hour <= 20;
            const inflow = pumpOn ? 6.2 + Math.random() * 0.6 + (rainSpike > 1 ? 4.5 : 0) : (0.4 + Math.random() * 0.3);
            const gatePos = rainSpike > 1.5 ? 0.6 : (hour >= 8 && hour <= 18 ? 0.25 : 0.1);
            const outflow = gatePos * 7.0 + (Math.random() - 0.5) * 0.2;

            const record = {
                timestamp,
                waterLevel: round(level, 2),
                waterPercentage: round(percentage, 1),
                storage: round(storage, 2),
                inflowRate: round(Math.max(0, inflow), 2),
                outflowRate: round(Math.max(0, outflow), 2),
                gatePosition: round(gatePos, 2),
                pumpStatus: pumpOn ? "ON" : "OFF",
                solenoidStatus: hour >= 7 && hour <= 17 ? "OPEN" : "CLOSED"
            };

            updates[timestamp] = record;
        }

        await set(historyRef, updates);
        console.log(`[HistorySeed] Seeded ${Object.keys(updates).length} points successfully.`);
        return { seeded: true, count: Object.keys(updates).length };
    } catch (err) {
        console.error("[HistorySeed] Seeding failed:", err);
        return { seeded: false, error: err.message };
    }
}
