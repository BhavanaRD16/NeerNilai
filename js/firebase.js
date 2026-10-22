/**
 * NeerNilai – Firebase Realtime Database initialization
 * Single source of truth for SDK setup. Import this module from every page.
 * 
 * v2: All data is namespaced under /dams/{damId}/… for multi-dam support.
 *     damPath(damId, subPath) generates the correct path.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
    getDatabase,
    ref,
    onValue,
    set,
    update,
    push,
    remove,
    get,
    query,
    orderByKey,
    limitToLast,
    onDisconnect,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBE_o7ZfcEu0yo32pVNo1cHPJrQ1TdVHgY",
    authDomain: "neernilai.firebaseapp.com",
    projectId: "neernilai",
    storageBucket: "neernilai.firebasestorage.app",
    messagingSenderId: "214448199620",
    appId: "1:214448199620:web:71bc4a72a03c3ef3c3f691",
    databaseURL: "https://neernilai-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ------------------------------------------------------------------ */
/*  Path helpers – all data lives under /dams/{damId}/…               */
/* ------------------------------------------------------------------ */

/** Sub-paths within each dam namespace */
export const SUB = {
    device:            "device",
    telemetryCurrent:  "telemetry/current",
    telemetryHistory:  "telemetry/history",
    controls:          "controls",
    settings:          "settings",
    alerts:            "alerts",
    logs:              "logs"
};

/** Firebase-level paths (not per-dam) */
export const GLOBAL = {
    connected: ".info/connected",
    users:     "users",
    meta:      "meta"        // migration flag, global config
};

/**
 * Build a per-dam Firebase path.
 * @param {string} damId  – e.g. "mettur"
 * @param {string} sub    – e.g. SUB.telemetryCurrent or "controls/pump"
 * @returns {string}
 */
export function damPath(damId, sub) {
    return `dams/${damId}/${sub}`;
}

/* ------------------------------------------------------------------ */
/*  Legacy flat PATHS (kept for migration helper & fallback)          */
/* ------------------------------------------------------------------ */
export const LEGACY_PATHS = {
    device: "device",
    telemetryCurrent: "telemetry/current",
    telemetryHistory: "telemetry/history",
    controls: "controls",
    settings: "settings",
    alerts: "alerts",
    logs: "logs",
    users: "users",
    connected: ".info/connected"
};

/** Default active dam fallback PATHS for transitional compatibility */
export const PATHS = {
    device: "dams/mettur/device",
    telemetryCurrent: "dams/mettur/telemetry/current",
    telemetryHistory: "dams/mettur/telemetry/history",
    controls: "dams/mettur/controls",
    settings: "dams/mettur/settings",
    alerts: "dams/mettur/alerts",
    logs: "dams/mettur/logs",
    users: "users",
    connected: ".info/connected"
};

/* ------------------------------------------------------------------ */
/*  Per-Dam Default Profiles                                          */
/* ------------------------------------------------------------------ */

/**
 * Scale factors to map prototype values (cm, L, L/min) to real-dam units (ft, TMC, cusecs).
 * Each dam can have its own factor; these are editable in settings.
 */
export const DAM_PROFILES = {
    mettur: {
        settings: {
            maxTankHeight: 15,
            maxCapacity: 50,
            warningLevel: 12,
            criticalLevel: 13.5,
            overflowSafety: true,
            scaleFactor: { heightFtPerCm: 8.6, capacityTmcPerL: 1.869, flowCusecsPerLpm: 166.5 }
        },
        controls: { pump: "OFF", solenoid: "CLOSED", gate: { command: "STOP", position: 0, step: 0.25, commandId: 0 } },
        device:   { id: "ESP32_RESERVOIR_01", online: false, lastSeen: 0 },
        simProfile: { baseInflow: 1.2, baseOutflow: 0.8, baseLevel: 7.5, personality: "steady" }
    },
    vaigai: {
        settings: {
            maxTankHeight: 12,
            maxCapacity: 40,
            warningLevel: 9.5,
            criticalLevel: 11,
            overflowSafety: true,
            scaleFactor: { heightFtPerCm: 7.2, capacityTmcPerL: 0.152, flowCusecsPerLpm: 140 }
        },
        controls: { pump: "OFF", solenoid: "CLOSED", gate: { command: "STOP", position: 0, step: 0.25, commandId: 0 } },
        device:   { id: "ESP32_RESERVOIR_02", online: false, lastSeen: 0 },
        simProfile: { baseInflow: 0.9, baseOutflow: 0.6, baseLevel: 5.0, personality: "variable" }
    },
    bhavanisagar: {
        settings: {
            maxTankHeight: 18,
            maxCapacity: 65,
            warningLevel: 14.5,
            criticalLevel: 16.5,
            overflowSafety: true,
            scaleFactor: { heightFtPerCm: 6.5, capacityTmcPerL: 0.505, flowCusecsPerLpm: 155 }
        },
        controls: { pump: "OFF", solenoid: "CLOSED", gate: { command: "STOP", position: 0, step: 0.25, commandId: 0 } },
        device:   { id: "ESP32_RESERVOIR_03", online: false, lastSeen: 0 },
        simProfile: { baseInflow: 1.5, baseOutflow: 1.0, baseLevel: 9.0, personality: "steady" }
    },
    periyar: {
        settings: {
            maxTankHeight: 14,
            maxCapacity: 45,
            warningLevel: 11,
            criticalLevel: 12.8,
            overflowSafety: true,
            scaleFactor: { heightFtPerCm: 10.0, capacityTmcPerL: 0.344, flowCusecsPerLpm: 180 }
        },
        controls: { pump: "OFF", solenoid: "CLOSED", gate: { command: "STOP", position: 0, step: 0.25, commandId: 0 } },
        device:   { id: "ESP32_RESERVOIR_04", online: false, lastSeen: 0 },
        simProfile: { baseInflow: 1.0, baseOutflow: 0.7, baseLevel: 6.5, personality: "monsoon-prone" }
    },
    pechiparai: {
        settings: {
            maxTankHeight: 10,
            maxCapacity: 35,
            warningLevel: 8,
            criticalLevel: 9.2,
            overflowSafety: true,
            scaleFactor: { heightFtPerCm: 5.8, capacityTmcPerL: 0.123, flowCusecsPerLpm: 120 }
        },
        controls: { pump: "OFF", solenoid: "CLOSED", gate: { command: "STOP", position: 0, step: 0.25, commandId: 0 } },
        device:   { id: "ESP32_RESERVOIR_05", online: false, lastSeen: 0 },
        simProfile: { baseInflow: 0.8, baseOutflow: 0.5, baseLevel: 4.0, personality: "drought-prone" }
    },
    aliyar: {
        settings: {
            maxTankHeight: 11,
            maxCapacity: 38,
            warningLevel: 8.8,
            criticalLevel: 10,
            overflowSafety: true,
            scaleFactor: { heightFtPerCm: 6.2, capacityTmcPerL: 0.102, flowCusecsPerLpm: 130 }
        },
        controls: { pump: "OFF", solenoid: "CLOSED", gate: { command: "STOP", position: 0, step: 0.25, commandId: 0 } },
        device:   { id: "ESP32_RESERVOIR_06", online: false, lastSeen: 0 },
        simProfile: { baseInflow: 1.1, baseOutflow: 0.7, baseLevel: 5.5, personality: "steady" }
    },
    sathanur: {
        settings: {
            maxTankHeight: 13,
            maxCapacity: 42,
            warningLevel: 10.4,
            criticalLevel: 12,
            overflowSafety: true,
            scaleFactor: { heightFtPerCm: 7.8, capacityTmcPerL: 0.174, flowCusecsPerLpm: 145 }
        },
        controls: { pump: "OFF", solenoid: "CLOSED", gate: { command: "STOP", position: 0, step: 0.25, commandId: 0 } },
        device:   { id: "ESP32_RESERVOIR_07", online: false, lastSeen: 0 },
        simProfile: { baseInflow: 1.0, baseOutflow: 0.65, baseLevel: 6.0, personality: "variable" }
    }
};

/** Quick accessor for a dam's default settings */
export function getDefaultSettings(damId) {
    return DAM_PROFILES[damId]?.settings || DAM_PROFILES.mettur.settings;
}

/** Quick accessor for a dam's default controls */
export function getDefaultControls(damId) {
    return DAM_PROFILES[damId]?.controls || DAM_PROFILES.mettur.controls;
}

/** Quick accessor for a dam's default device */
export function getDefaultDevice(damId) {
    return DAM_PROFILES[damId]?.device || DAM_PROFILES.mettur.device;
}

/** Quick accessor for a dam's simulator profile */
export function getSimProfile(damId) {
    return DAM_PROFILES[damId]?.simProfile || DAM_PROFILES.mettur.simProfile;
}

/* ------------------------------------------------------------------ */
/*  Default Seeding (per-dam)                                         */
/* ------------------------------------------------------------------ */

/**
 * Seed settings, controls, and device nodes for a specific dam if they
 * do not exist yet. Safe to call from any page, for any dam.
 */
export async function ensureDefaults(damId = "mettur") {
    const profile = DAM_PROFILES[damId];
    if (!profile) {
        console.warn(`Unknown dam ID "${damId}", falling back to mettur`);
        return ensureDefaults("mettur");
    }

    try {
        const fetchWithTimeout = (promise, ms = 2500) => Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
        ]);

        const [settingsSnap, controlsSnap, deviceSnap] = await fetchWithTimeout(Promise.all([
            get(ref(db, damPath(damId, SUB.settings))),
            get(ref(db, damPath(damId, SUB.controls))),
            get(ref(db, damPath(damId, SUB.device)))
        ]), 2500);

        const writes = [];
        if (!settingsSnap.exists()) {
            writes.push(set(ref(db, damPath(damId, SUB.settings)), profile.settings));
        }
        if (!controlsSnap.exists()) {
            writes.push(set(ref(db, damPath(damId, SUB.controls)), profile.controls));
        }
        if (!deviceSnap.exists()) {
            writes.push(set(ref(db, damPath(damId, SUB.device)), profile.device));
        }

        if (writes.length > 0) {
            await Promise.all(writes);
        }
    } catch (error) {
        console.warn(`[Firebase] ensureDefaults fallback for dam "${damId}":`, error.message);
    }
}

/**
 * Seed defaults for ALL 7 Tamil Nadu dams.
 */
export async function ensureAllDamDefaults() {
    const ids = Object.keys(DAM_PROFILES);
    await Promise.all(ids.map((id) => ensureDefaults(id)));
}

/* ------------------------------------------------------------------ */
/*  Exports                                                           */
/* ------------------------------------------------------------------ */

export {
    db,
    ref,
    onValue,
    set,
    update,
    push,
    remove,
    get,
    query,
    orderByKey,
    limitToLast,
    onDisconnect,
    serverTimestamp
};
