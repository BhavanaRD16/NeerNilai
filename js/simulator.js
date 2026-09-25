/**
 * ESP32 telemetry simulator.
 * Writes realistic reservoir physics into Firebase so the dashboard
 * behaves as if a field device is online. Replace this page with a
 * real ESP32 later; the database schema stays the same.
 */

import {
    db,
    ref,
    onValue,
    set,
    update,
    onDisconnect,
    ensureDefaults,
    PATHS,
    DEFAULT_SETTINGS
} from "./firebase.js";
import { clamp, toNumber, round, storageFromLevel, setText, relativeTime } from "./utils.js";

const DEVICE_ID = "ESP32_RESERVOIR_01";

const sim = {
    running: false,
    timer: null,
    intervalMs: 2000,
    lastTick: 0,
    processedCommandId: 0,
    gateActual: 0.25,
    gateTarget: 0.25,
    waterLevel: 7.5,
    inflow: 1.2,
    outflow: 0.8,
    pump: "OFF",
    solenoid: "CLOSED",
    settings: { ...DEFAULT_SETTINGS },
    controls: null
};

function intervalFromUi() {
    const select = document.getElementById("simInterval");
    return Number(select?.value || 2000);
}

function applyControls() {
    const controls = sim.controls || {};
    sim.pump = String(controls.pump || "OFF").toUpperCase() === "ON" ? "ON" : "OFF";
    sim.solenoid = String(controls.solenoid || "CLOSED").toUpperCase() === "OPEN" ? "OPEN" : "CLOSED";

    const gate = controls.gate || {};
    const commandId = toNumber(gate.commandId, 0);
    const command = String(gate.command || "STOP").toUpperCase();
    const step = clamp(toNumber(gate.step, 0.25), 0.1, 1);

    if (commandId && commandId !== sim.processedCommandId) {
        sim.processedCommandId = commandId;
        if (command === "OPEN_FULL") sim.gateTarget = 1;
        else if (command === "CLOSE_FULL") sim.gateTarget = 0;
        else if (command === "STEP_OPEN") sim.gateTarget = clamp(sim.gateActual + step, 0, 1);
        else if (command === "STEP_CLOSE") sim.gateTarget = clamp(sim.gateActual - step, 0, 1);
        else if (command === "STOP" || command === "HOLD") sim.gateTarget = sim.gateActual;
    } else if (command === "OPEN_FULL") {
        sim.gateTarget = 1;
    } else if (command === "CLOSE_FULL") {
        sim.gateTarget = 0;
    } else if (command === "STOP" || command === "HOLD") {
        sim.gateTarget = sim.gateActual;
    }
}

function stepPhysics(dtSeconds) {
    applyControls();

    const gateSpeed = 0.18;
    const gateDelta = clamp(sim.gateTarget - sim.gateActual, -gateSpeed * dtSeconds, gateSpeed * dtSeconds);
    sim.gateActual = clamp(sim.gateActual + gateDelta, 0, 1);

    const inflowTarget = sim.pump === "ON" ? 6.8 + Math.sin(Date.now() / 4000) * 1.4 : 0.35;
    const inflowTau = sim.pump === "ON" ? 4 : 3;
    sim.inflow += (inflowTarget - sim.inflow) * (1 - Math.exp(-dtSeconds / inflowTau));
    sim.inflow = clamp(sim.inflow + (Math.random() - 0.5) * 0.08, 0, 10);

    const gateOut = sim.gateActual * 7.2;
    const solenoidOut = sim.solenoid === "OPEN" ? 1.6 : 0;
    const outflowTarget = clamp(gateOut + solenoidOut, 0, 10);
    sim.outflow += (outflowTarget - sim.outflow) * (1 - Math.exp(-dtSeconds / 2.5));
    sim.outflow = clamp(sim.outflow + (Math.random() - 0.5) * 0.06, 0, 10);

    const maxHeight = toNumber(sim.settings.maxTankHeight, 15);
    const maxCapacity = toNumber(sim.settings.maxCapacity, 50);
    const deltaStorage = (sim.inflow - sim.outflow) * (dtSeconds / 60);
    const deltaLevel = maxCapacity > 0 ? (deltaStorage / maxCapacity) * maxHeight : 0;
    sim.waterLevel = clamp(sim.waterLevel + deltaLevel, 0, maxHeight);
}

function snapshot() {
    const { percentage, storage } = storageFromLevel(sim.waterLevel, sim.settings);
    return {
        waterLevel: round(sim.waterLevel, 2),
        waterPercentage: round(percentage, 1),
        storage: round(storage, 2),
        inflowRate: round(sim.inflow, 2),
        outflowRate: round(sim.outflow, 2),
        gatePosition: round(sim.gateActual, 3),
        pumpStatus: sim.pump,
        solenoidStatus: sim.solenoid,
        timestamp: Date.now()
    };
}

async function publish(sample) {
    try {
        await Promise.all([
            set(ref(db, PATHS.telemetryCurrent), sample),
            set(ref(db, `${PATHS.telemetryHistory}/${sample.timestamp}`), sample),
            update(ref(db, PATHS.device), {
                id: DEVICE_ID,
                online: true,
                lastSeen: sample.timestamp
            })
        ]);
    } catch (error) {
        console.error("Simulator publish failed:", error);
        setText("simError", "Firebase write failed. Check database rules and connection.");
    }
}

async function tick() {
    const now = Date.now();
    const dt = sim.lastTick ? clamp((now - sim.lastTick) / 1000, 0.2, 5) : sim.intervalMs / 1000;
    sim.lastTick = now;
    stepPhysics(dt);
    const sample = snapshot();
    await publish(sample);
    renderPreview(sample);
}

function renderPreview(sample) {
    setText("simDevice", DEVICE_ID);
    setText("simRunState", sim.running ? "RUNNING" : "STOPPED");
    document.getElementById("simRunState")?.classList.toggle("pill-on", sim.running);
    document.getElementById("simRunState")?.classList.toggle("pill-off", !sim.running);
    setText("simLastWrite", relativeTime(sample.timestamp));
    setText("prevLevel", `${sample.waterLevel.toFixed(2)} cm`);
    setText("prevPercent", `${sample.waterPercentage.toFixed(1)}%`);
    setText("prevStorage", `${sample.storage.toFixed(2)} L`);
    setText("prevInflow", `${sample.inflowRate.toFixed(2)} L/min`);
    setText("prevOutflow", `${sample.outflowRate.toFixed(2)} L/min`);
    setText("prevGate", `${sample.gatePosition.toFixed(2)} rot`);
    setText("prevPump", sample.pumpStatus);
    setText("prevSolenoid", sample.solenoidStatus);
    setText("simError", "");
}

async function markOffline() {
    try {
        await update(ref(db, PATHS.device), {
            id: DEVICE_ID,
            online: false,
            lastSeen: Date.now()
        });
    } catch (error) {
        console.error("Failed to mark device offline:", error);
    }
}

async function startSimulator() {
    if (sim.running) return;
    sim.intervalMs = intervalFromUi();
    sim.running = true;
    sim.lastTick = 0;
    setText("simIntervalLabel", `${sim.intervalMs / 1000} s`);

    try {
        await onDisconnect(ref(db, PATHS.device)).update({
            id: DEVICE_ID,
            online: false
        });
    } catch (error) {
        console.error("onDisconnect registration failed:", error);
    }

    await tick();
    sim.timer = setInterval(tick, sim.intervalMs);
    renderPreview(snapshot());
}

async function stopSimulator() {
    sim.running = false;
    if (sim.timer) {
        clearInterval(sim.timer);
        sim.timer = null;
    }
    await markOffline();
    renderPreview(snapshot());
}

function bindUi() {
    document.getElementById("startSim")?.addEventListener("click", startSimulator);
    document.getElementById("stopSim")?.addEventListener("click", stopSimulator);
    document.getElementById("simInterval")?.addEventListener("change", async () => {
        sim.intervalMs = intervalFromUi();
        setText("simIntervalLabel", `${sim.intervalMs / 1000} s`);
        if (sim.running) {
            clearInterval(sim.timer);
            sim.timer = setInterval(tick, sim.intervalMs);
        }
    });
}

function subscribeInputs() {
    onValue(ref(db, PATHS.settings), (snap) => {
        sim.settings = snap.val() || { ...DEFAULT_SETTINGS };
    }, (error) => console.error("settings listener failed:", error));

    onValue(ref(db, PATHS.controls), (snap) => {
        sim.controls = snap.val();
        if (sim.controls?.gate?.position != null && !sim.running) {
            sim.gateActual = clamp(toNumber(sim.controls.gate.position, sim.gateActual), 0, 1);
            sim.gateTarget = sim.gateActual;
        }
    }, (error) => console.error("controls listener failed:", error));

    onValue(ref(db, PATHS.telemetryCurrent), (snap) => {
        const current = snap.val();
        if (current && !sim.running) {
            sim.waterLevel = toNumber(current.waterLevel, sim.waterLevel);
            sim.inflow = toNumber(current.inflowRate, sim.inflow);
            sim.outflow = toNumber(current.outflowRate, sim.outflow);
            sim.gateActual = toNumber(current.gatePosition, sim.gateActual);
            sim.pump = current.pumpStatus || sim.pump;
            sim.solenoid = current.solenoidStatus || sim.solenoid;
            renderPreview({
                ...current,
                timestamp: current.timestamp || 0
            });
        }
    }, (error) => console.error("telemetry listener failed:", error));
}

async function init() {
    bindUi();
    setText("simDevice", DEVICE_ID);
    setText("simIntervalLabel", `${intervalFromUi() / 1000} s`);
    try {
        await ensureDefaults();
    } catch (error) {
        console.error("Firebase initialization error:", error);
        setText("simError", "Firebase Connection Error");
    }
    subscribeInputs();
    renderPreview(snapshot());
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("beforeunload", () => {
    if (sim.running) markOffline();
});
