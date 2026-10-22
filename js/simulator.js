/**
 * ESP32 Telemetry & Firmware-Brain Simulator
 * Simulates physical reservoir hardware (tank, ultrasonic level sensor, DC pump,
 * pulse flow sensors, stepper motor gear train, solenoid valve) with:
 * - Autonomous firmware-side safety logic (independent of browser dashboard)
 * - Sensor noise models & physical jitter
 * - Stepper acceleration & mechanical bounds
 * - Scenario Director engine integration
 * - Speed multiplier acceleration (1x, 5x, 20x, 60x)
 * - Multi-dam namespacing (/dams/{damId}/...)
 */

import {
    db,
    ref,
    onValue,
    set,
    update,
    push,
    onDisconnect,
    ensureDefaults,
    SUB,
    GLOBAL,
    damPath,
    DAM_PROFILES,
    PATHS
} from "./firebase.js";
import {
    clamp,
    toNumber,
    round,
    storageFromLevel,
    setText,
    relativeTime,
    simNow,
    setSimSpeed,
    getSimSpeed
} from "./utils.js";
import { initAuth, getSelectedDam, onAuthChange, ROLES, getCurrentUser } from "./auth.js";
import { setupAuthUi } from "./authUi.js";
import { scenarioDirector, SCENARIO_DEFS } from "./scenarios.js";
import { seedHistoryIfEmpty } from "./historySeed.js";

const OVERFLOW_THRESHOLD_PCT = 80.0;

let activeDamId = "mettur";
let activeUnsubscribers = [];

const sim = {
    running: false,
    timer: null,
    intervalMs: 1000,
    baseIntervalMs: 1000,
    lastTick: 0,
    processedCommandId: 0,

    // Physical state
    gateActual: 0.25,        // Rotations 0.0 to 1.0
    gateTarget: 0.25,
    gateVelocity: 0,
    waterLevel: 7.5,         // cm
    inflow: 1.2,             // L/min
    outflow: 0.8,            // L/min
    pump: "OFF",
    solenoid: "CLOSED",

    // Hardware alarms
    firmwareEmergencyActive: false,
    gateJammed: false,
    pumpFault: false,

    // Firebase state mirrors
    settings: { ...DAM_PROFILES.mettur.settings },
    controls: null,
    deviceInfo: { ...DAM_PROFILES.mettur.device }
};

function getActiveDeviceId() {
    return DAM_PROFILES[activeDamId]?.device?.id || "ESP32_RESERVOIR_01";
}

function intervalFromUi() {
    const select = document.getElementById("simInterval");
    return Number(select?.value || 1000);
}

/**
 * Handle incoming control commands from Firebase controls/
 */
function applyControls() {
    const controls = sim.controls || {};
    sim.pump = String(controls.pump || "OFF").toUpperCase() === "ON" ? "ON" : "OFF";
    sim.solenoid = String(controls.solenoid || "CLOSED").toUpperCase() === "OPEN" ? "OPEN" : "CLOSED";

    const gate = controls.gate || {};
    const commandId = toNumber(gate.commandId, 0);
    const command = String(gate.command || "STOP").toUpperCase();
    const step = clamp(toNumber(gate.step, 0.25), 0.05, 1);

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

/**
 * Autonomous Firmware Safety Loop (Emulates on-chip logic in ESP32 void loop())
 * Runs even when dashboard is disconnected.
 */
async function runFirmwareSafetyLogic() {
    const maxHeight = toNumber(sim.settings.maxTankHeight, 15);
    const pct = maxHeight > 0 ? (sim.waterLevel / maxHeight) * 100 : 0;
    const safetyEnabled = sim.settings.overflowSafety !== false;

    if (safetyEnabled && pct >= OVERFLOW_THRESHOLD_PCT) {
        if (!sim.firmwareEmergencyActive) {
            sim.firmwareEmergencyActive = true;
            console.warn(`[ESP32_FIRMWARE] OVERFLOW RISK TRIGGERED (${pct.toFixed(1)}%). Auto opening gate 100% and shutting down intake pump.`);
            sim.gateTarget = 1.0;
            sim.pump = "OFF";

            // Log autonomous firmware intervention to Firebase
            try {
                await push(ref(db, damPath(activeDamId, SUB.logs)), {
                    timestamp: Date.now(),
                    damId: activeDamId,
                    command: "FIRMWARE_AUTO_SPILLWAY_DISPATCH",
                    target: "ESP32 Autonomous Brain",
                    previousState: `Level: ${sim.waterLevel.toFixed(1)}cm (${pct.toFixed(0)}%)`,
                    newState: "GATE_OPEN_FULL_PUMP_OFF",
                    status: "EXECUTED_AUTONOMOUSLY"
                });
            } catch (e) {
                // Ignore offline logging errors
            }
        }
    } else if (pct < OVERFLOW_THRESHOLD_PCT - 8.0) {
        // Hysteresis clearance
        sim.firmwareEmergencyActive = false;
    }
}

/**
 * Step differential equations for reservoir physics.
 */
function stepPhysics(dtSeconds) {
    applyControls();
    scenarioDirector.tick(dtSeconds);

    const mods = scenarioDirector.evaluatePhysicsMods({
        inflow: sim.inflow,
        outflow: sim.outflow,
        waterLevel: sim.waterLevel,
        gateActual: sim.gateActual,
        pump: sim.pump,
        solenoid: sim.solenoid,
        settings: sim.settings
    });

    sim.gateJammed = mods.gateJammed;
    sim.pumpFault = mods.pumpStalled;

    // Stepper motor physics: acceleration and speed clamping
    const maxAllowedGate = mods.gateMaxOpening;
    const effectiveTarget = Math.min(sim.gateTarget, maxAllowedGate);
    const gateSpeed = 0.22; // rot / sec max slew rate
    const gateDelta = clamp(effectiveTarget - sim.gateActual, -gateSpeed * dtSeconds, gateSpeed * dtSeconds);
    sim.gateActual = clamp(sim.gateActual + gateDelta, 0, 1);

    // Inflow dynamics
    let targetInflow;
    if (mods.inflowOverride !== null) {
        targetInflow = mods.inflowOverride;
    } else if (sim.pumpFault) {
        targetInflow = 0;
    } else if (sim.pump === "ON") {
        targetInflow = 7.2 + Math.sin(Date.now() / 3500) * 1.5;
    } else {
        targetInflow = 0.45; // Natural river base inflow
    }

    const inflowTau = sim.pump === "ON" ? 3.5 : 2.5;
    sim.inflow += (targetInflow - sim.inflow) * (1 - Math.exp(-dtSeconds / inflowTau));
    sim.inflow = clamp(sim.inflow + (Math.random() - 0.5) * 0.08, 0, 15);

    // Outflow dynamics: Sluice gate spillway discharge + Solenoid irrigation line
    const gateDischarge = (sim.gateActual * 7.8) * mods.outflowMultiplier;
    const solenoidDischarge = sim.solenoid === "OPEN" ? 1.8 : 0;
    const targetOutflow = clamp(gateDischarge + solenoidDischarge, 0, 15);

    sim.outflow += (targetOutflow - sim.outflow) * (1 - Math.exp(-dtSeconds / 2.0));
    sim.outflow = clamp(sim.outflow + (Math.random() - 0.5) * 0.06, 0, 15);

    // Water level balance: dV/dt = Inflow - Outflow
    const maxHeight = toNumber(sim.settings.maxTankHeight, 15);
    const maxCapacity = toNumber(sim.settings.maxCapacity, 50);
    const deltaStorage = (sim.inflow - sim.outflow) * (dtSeconds / 60);
    const deltaLevel = maxCapacity > 0 ? (deltaStorage / maxCapacity) * maxHeight : 0;

    sim.waterLevel = clamp(sim.waterLevel + deltaLevel, 0, maxHeight);

    // Run on-chip autonomous safety
    runFirmwareSafetyLogic();

    return mods;
}

/**
 * Generate telemetry snapshot with sensor noise and conversion characteristics
 */
function snapshot(mods = {}) {
    const { percentage, storage } = storageFromLevel(sim.waterLevel, sim.settings);

    // Ultrasonic sensor jitter (±0.25 cm standard acoustic variation)
    let reportedLevel = sim.waterLevel;
    if (mods.sensorDropOut) {
        reportedLevel = NaN;
    } else {
        const noise = mods.sensorNoise || ((Math.random() - 0.5) * 0.35);
        reportedLevel = clamp(round(sim.waterLevel + noise, 2), 0, toNumber(sim.settings.maxTankHeight, 15));
    }

    return {
        waterLevel: isNaN(reportedLevel) ? null : reportedLevel,
        waterPercentage: round(percentage, 1),
        storage: round(storage, 2),
        inflowRate: round(sim.inflow, 2),
        outflowRate: round(sim.outflow, 2),
        gatePosition: round(sim.gateActual, 3),
        pumpStatus: sim.pumpFault ? "FAULT_STALL" : sim.pump,
        solenoidStatus: sim.solenoid,
        timestamp: Date.now(),
        firmwareSafety: sim.firmwareEmergencyActive ? "TRIGGERED" : "NOMINAL",
        activeScenario: scenarioDirector.activeScenario
    };
}

/**
 * Publish telemetry to Firebase namespaced paths
 */
async function publish(sample, wifiSuppressed = false) {
    if (wifiSuppressed) {
        setText("simError", "SIMULATED TELEMETRY DROP: Cloud socket silent (firmware running locally)");
        return;
    }

    try {
        const currPath = damPath(activeDamId, SUB.telemetryCurrent);
        const histPath = `${damPath(activeDamId, SUB.telemetryHistory)}/${sample.timestamp}`;
        const devPath = damPath(activeDamId, SUB.device);

        await Promise.all([
            set(ref(db, currPath), sample),
            set(ref(db, histPath), sample),
            update(ref(db, devPath), {
                id: getActiveDeviceId(),
                online: true,
                lastSeen: sample.timestamp,
                firmwareSafety: sim.firmwareEmergencyActive ? "ACTIVE" : "STANDBY"
            })
        ]);
        setText("simError", "");
    } catch (error) {
        console.error("Simulator publish failed:", error);
        setText("simError", "Firebase write failed. Check database rules and network.");
    }
}

async function tick() {
    const now = Date.now();
    const speed = getSimSpeed();
    const realDt = sim.lastTick ? (now - sim.lastTick) / 1000 : sim.intervalMs / 1000;
    sim.lastTick = now;

    // Apply simulation speed multiplier
    const effectiveDt = clamp(realDt * speed, 0.1, 10);

    const mods = stepPhysics(effectiveDt);
    const sample = snapshot(mods);

    await publish(sample, mods.wifiSuppressed);
    renderPreview(sample);
}

function renderPreview(sample) {
    setText("simDevice", getActiveDeviceId());
    setText("simRunState", sim.running ? "RUNNING" : "STOPPED");
    document.getElementById("simRunState")?.classList.toggle("pill-on", sim.running);
    document.getElementById("simRunState")?.classList.toggle("pill-off", !sim.running);

    setText("simLastWrite", relativeTime(sample.timestamp));
    setText("prevLevel", sample.waterLevel !== null ? `${sample.waterLevel.toFixed(2)} cm` : "SENSOR_DROPOUT");
    setText("prevPercent", `${sample.waterPercentage.toFixed(1)}%`);
    setText("prevStorage", `${sample.storage.toFixed(2)} L`);
    setText("prevInflow", `${sample.inflowRate.toFixed(2)} L/min`);
    setText("prevOutflow", `${sample.outflowRate.toFixed(2)} L/min`);
    setText("prevGate", `${sample.gatePosition.toFixed(2)} rot ${sim.gateJammed ? "[JAMMED]" : ""}`);
    setText("prevPump", sample.pumpStatus);
    setText("prevSolenoid", sample.solenoidStatus);

    // Active scenario badge
    const activeDef = scenarioDirector.getActiveDef();
    setText("activeScenarioName", `${activeDef.name} (${scenarioDirector.elapsedSec.toFixed(0)}s)`);
}

async function markOffline() {
    try {
        await update(ref(db, damPath(activeDamId, SUB.device)), {
            id: getActiveDeviceId(),
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
        await onDisconnect(ref(db, damPath(activeDamId, SUB.device))).update({
            id: getActiveDeviceId(),
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

    // Speed multiplier buttons
    document.querySelectorAll("[data-sim-speed]").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("[data-sim-speed]").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const spd = Number(btn.dataset.simSpeed || 1);
            setSimSpeed(spd);
            console.log(`[Simulator] Speed multiplier set to: ${spd}x`);
        });
    });

    // Scenario selection buttons
    document.querySelectorAll("[data-scenario]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const scId = btn.dataset.scenario;
            scenarioDirector.setScenario(scId);
            document.querySelectorAll("[data-scenario]").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
        });
    });

    // Pre-seed 24h history button
    document.getElementById("btnSeedHistory")?.addEventListener("click", async () => {
        const btn = document.getElementById("btnSeedHistory");
        if (btn) btn.disabled = true;
        const res = await seedHistoryIfEmpty(activeDamId, sim.settings, true);
        alert(`24h history generated: ${res.count || 0} records written.`);
        if (btn) btn.disabled = false;
    });
}

function unsubscribeAll() {
    activeUnsubscribers.forEach((unsub) => {
        try { unsub(); } catch (e) { /* ignore */ }
    });
    activeUnsubscribers = [];
}

function subscribeInputs(damId) {
    unsubscribeAll();
    activeDamId = damId || getSelectedDam()?.id || "mettur";

    // Load dam settings profile
    const profile = DAM_PROFILES[activeDamId] || DAM_PROFILES.mettur;
    sim.settings = { ...profile.settings };
    sim.deviceInfo = { ...profile.device };

    const unsubSettings = onValue(ref(db, damPath(activeDamId, SUB.settings)), (snap) => {
        sim.settings = snap.val() || { ...profile.settings };
    }, (error) => console.error("settings listener failed:", error));
    activeUnsubscribers.push(unsubSettings);

    const unsubControls = onValue(ref(db, damPath(activeDamId, SUB.controls)), (snap) => {
        sim.controls = snap.val();
        if (sim.controls?.gate?.position != null && !sim.running) {
            sim.gateActual = clamp(toNumber(sim.controls.gate.position, sim.gateActual), 0, 1);
            sim.gateTarget = sim.gateActual;
        }
    }, (error) => console.error("controls listener failed:", error));
    activeUnsubscribers.push(unsubControls);

    const unsubTelemetry = onValue(ref(db, damPath(activeDamId, SUB.telemetryCurrent)), (snap) => {
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
    activeUnsubscribers.push(unsubTelemetry);
}

async function init() {
    await initAuth();
    setupAuthUi();
    bindUi();

    const selectedDam = getSelectedDam()?.id || "mettur";
    setText("simDevice", getActiveDeviceId());
    setText("simIntervalLabel", `${intervalFromUi() / 1000} s`);

    try {
        await ensureDefaults(selectedDam);
        // Pre-seed 24h history automatically if empty
        await seedHistoryIfEmpty(selectedDam, DAM_PROFILES[selectedDam]?.settings);
    } catch (error) {
        console.error("Firebase initialization error:", error);
        setText("simError", "Firebase Connection Error");
    }

    subscribeInputs(selectedDam);

    onAuthChange((user, dam) => {
        if (dam && dam.id !== activeDamId) {
            const wasRunning = sim.running;
            if (wasRunning) stopSimulator();
            subscribeInputs(dam.id);
            if (wasRunning) startSimulator();
        }
    });

    renderPreview(snapshot());
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("beforeunload", () => {
    if (sim.running) markOffline();
    unsubscribeAll();
});
