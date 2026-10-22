/**
 * NeerNilai – One-time Migration Helper
 * Moves flat Firebase paths (device, telemetry, controls, settings, alerts, logs)
 * into the namespaced /dams/mettur/… structure.
 * 
 * Safe to call multiple times – checks a /meta/migrated flag.
 */

import {
    db, ref, get, set, remove, update,
    LEGACY_PATHS, SUB, damPath, GLOBAL
} from "./firebase.js";

/**
 * Check if migration has already been performed.
 */
export async function isMigrated() {
    try {
        const snap = await get(ref(db, `${GLOBAL.meta}/migrated`));
        return snap.exists() && snap.val() === true;
    } catch {
        return false;
    }
}

/**
 * Migrate flat paths to /dams/mettur/… (the original single-dam data).
 * Returns { migrated: true, counts: {...} } or { migrated: false, reason: "..." }
 */
export async function migrateFlatToNamespaced() {
    if (await isMigrated()) {
        return { migrated: false, reason: "Already migrated" };
    }

    const counts = {};
    const DEFAULT_DAM = "mettur";

    const pathMap = [
        { from: LEGACY_PATHS.device,           to: SUB.device },
        { from: LEGACY_PATHS.telemetryCurrent,  to: SUB.telemetryCurrent },
        { from: LEGACY_PATHS.telemetryHistory,  to: SUB.telemetryHistory },
        { from: LEGACY_PATHS.controls,          to: SUB.controls },
        { from: LEGACY_PATHS.settings,          to: SUB.settings },
        { from: LEGACY_PATHS.alerts,            to: SUB.alerts },
        { from: LEGACY_PATHS.logs,              to: SUB.logs }
    ];

    for (const { from, to } of pathMap) {
        try {
            const snap = await get(ref(db, from));
            if (snap.exists()) {
                const destPath = damPath(DEFAULT_DAM, to);
                // Check if destination already has data
                const destSnap = await get(ref(db, destPath));
                if (!destSnap.exists()) {
                    await set(ref(db, destPath), snap.val());
                    counts[from] = "copied";
                } else {
                    counts[from] = "skipped (destination exists)";
                }
            } else {
                counts[from] = "no data";
            }
        } catch (err) {
            counts[from] = `error: ${err.message}`;
        }
    }

    // Mark migration as complete
    await set(ref(db, `${GLOBAL.meta}/migrated`), true);
    await set(ref(db, `${GLOBAL.meta}/migratedAt`), Date.now());

    return { migrated: true, counts };
}

/**
 * Auto-migrate on first load if needed.
 * Call this early in app initialization.
 */
export async function autoMigrate() {
    try {
        const already = await isMigrated();
        if (!already) {
            // Check if there's any flat data to migrate
            const flatDevice = await get(ref(db, LEGACY_PATHS.device));
            if (flatDevice.exists()) {
                console.log("[NeerNilai] Migrating flat paths to namespaced structure…");
                const result = await migrateFlatToNamespaced();
                console.log("[NeerNilai] Migration result:", result);
            } else {
                // No flat data exists, just mark as migrated
                await set(ref(db, `${GLOBAL.meta}/migrated`), true);
            }
        }
    } catch (err) {
        console.warn("[NeerNilai] Auto-migration failed (non-fatal):", err);
    }
}
