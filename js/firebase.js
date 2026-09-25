/**
 * NeerNilai – Firebase Realtime Database initialization
 * Single source of truth for SDK setup. Import this module from every page.
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
    onDisconnect
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

export const PATHS = {
    device: "device",
    telemetryCurrent: "telemetry/current",
    telemetryHistory: "telemetry/history",
    controls: "controls",
    settings: "settings",
    alerts: "alerts",
    logs: "logs",
    connected: ".info/connected"
};

export const DEFAULT_SETTINGS = {
    maxTankHeight: 15,
    maxCapacity: 50,
    warningLevel: 12,
    criticalLevel: 13.5,
    overflowSafety: true
};

export const DEFAULT_CONTROLS = {
    pump: "OFF",
    solenoid: "CLOSED",
    gate: {
        command: "STOP",
        position: 0,
        step: 0.25,
        commandId: 0
    }
};

export const DEFAULT_DEVICE = {
    id: "ESP32_RESERVOIR_01",
    online: false,
    lastSeen: 0
};

/**
 * Seed settings, controls, and device nodes if they do not exist yet.
 * Safe to call from dashboard, admin, and simulator pages.
 */
export async function ensureDefaults() {
    try {
        const [settingsSnap, controlsSnap, deviceSnap] = await Promise.all([
            get(ref(db, PATHS.settings)),
            get(ref(db, PATHS.controls)),
            get(ref(db, PATHS.device))
        ]);

        if (!settingsSnap.exists()) {
            await set(ref(db, PATHS.settings), DEFAULT_SETTINGS);
        }
        if (!controlsSnap.exists()) {
            await set(ref(db, PATHS.controls), DEFAULT_CONTROLS);
        }
        if (!deviceSnap.exists()) {
            await set(ref(db, PATHS.device), DEFAULT_DEVICE);
        }
    } catch (error) {
        console.error("Failed to initialize Firebase defaults:", error);
        throw error;
    }
}

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
    onDisconnect
};
