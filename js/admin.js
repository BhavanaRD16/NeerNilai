/**
 * Administrative motor / valve / gate commands written to Firebase controls/ and logs/.
 * Displayed gate position is telemetry-confirmed, not assumed from the button click.
 */

import {
    db,
    ref,
    onValue,
    set,
    update,
    push,
    query,
    orderByKey,
    limitToLast,
    ensureDefaults,
    PATHS
} from "./firebase.js";
import {
    formatTimestamp,
    isDeviceOnline,
    toNumber,
    round,
    setText,
    relativeTime
} from "./utils.js";

const state = {
    firebaseConnected: false,
    device: null,
    telemetry: null,
    controls: null
};

function currentPump() {
    return String(state.telemetry?.pumpStatus || state.controls?.pump || "OFF").toUpperCase();
}

function currentSolenoid() {
    return String(state.telemetry?.solenoidStatus || state.controls?.solenoid || "CLOSED").toUpperCase();
}

function confirmedGate() {
    return toNumber(state.telemetry?.gatePosition, 0);
}

function commandedGate() {
    return String(state.controls?.gate?.command || "STOP");
}

async function writeLog({ command, target, previousState, newState, status = "SENT" }) {
    try {
        await push(ref(db, PATHS.logs), {
            timestamp: Date.now(),
            command,
            target,
            previousState,
            newState,
            status
        });
    } catch (error) {
        console.error("Failed to write command log:", error);
    }
}

function showCommandSent(message) {
    const el = document.getElementById("commandFeedback");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2500);
}

async function sendPump(next) {
    const previous = currentPump();
    try {
        await set(ref(db, "controls/pump"), next);
        await writeLog({
            command: next === "ON" ? "PUMP_ON" : "PUMP_OFF",
            target: "Inflow Pump",
            previousState: previous,
            newState: next
        });
        showCommandSent(`Command Sent: Inflow pump ${next}`);
    } catch (error) {
        console.error("Pump command failed:", error);
        showCommandSent("Command failed – check Firebase connection.");
    }
}

async function sendSolenoid(next) {
    const previous = currentSolenoid();
    try {
        await set(ref(db, "controls/solenoid"), next);
        await writeLog({
            command: next === "OPEN" ? "SOLENOID_OPEN" : "SOLENOID_CLOSE",
            target: "Irrigation Solenoid",
            previousState: previous,
            newState: next
        });
        showCommandSent(`Command Sent: Solenoid ${next}`);
    } catch (error) {
        console.error("Solenoid command failed:", error);
        showCommandSent("Command failed – check Firebase connection.");
    }
}

function selectedStep() {
    const select = document.getElementById("stepSize");
    return toNumber(select?.value, 0.25);
}

async function sendGate(command) {
    const previous = `${round(confirmedGate(), 2)} rot / ${commandedGate()}`;
    const commandId = Date.now();
    const payload = {
        command,
        step: selectedStep(),
        position: confirmedGate(),
        commandId
    };
    try {
        await update(ref(db, "controls/gate"), payload);
        await writeLog({
            command,
            target: "Reservoir Gate",
            previousState: previous,
            newState: `${command} (id ${commandId})`
        });
        showCommandSent(`Command Sent: Gate ${command.replaceAll("_", " ")}. Waiting for telemetry confirmation.`);
    } catch (error) {
        console.error("Gate command failed:", error);
        showCommandSent("Command failed – check Firebase connection.");
    }
}

function updateAdminUi() {
    const online = isDeviceOnline(state.device) && state.firebaseConnected;
    setText("adminDeviceStatus", online ? "ONLINE" : "OFFLINE");
    document.getElementById("adminDeviceStatus")?.classList.toggle("is-online", online);
    document.getElementById("adminDeviceStatus")?.classList.toggle("is-offline", !online);
    setText("adminLastSeen", relativeTime(state.device?.lastSeen));
    setText("firebaseAdminStatus", state.firebaseConnected ? "CONNECTED" : "ERROR");

    const pump = currentPump();
    const solenoid = currentSolenoid();
    setText("pumpState", pump);
    setText("solenoidState", solenoid);
    document.getElementById("pumpState")?.classList.toggle("pill-on", pump === "ON");
    document.getElementById("pumpState")?.classList.toggle("pill-off", pump !== "ON");
    document.getElementById("solenoidState")?.classList.toggle("pill-on", solenoid === "OPEN");
    document.getElementById("solenoidState")?.classList.toggle("pill-off", solenoid !== "OPEN");

    const confirmed = confirmedGate();
    setText("gateConfirmed", `${confirmed.toFixed(2)} / 1.00 rotation`);
    setText("gateConfirmedPct", `${round(confirmed * 100, 0)}% OPEN`);
    setText("gateCommand", commandedGate().replaceAll("_", " "));
    setText("gateCommandId", state.controls?.gate?.commandId ? String(state.controls.gate.commandId) : "—");

    const match = Math.abs(confirmed - toNumber(state.controls?.gate?.position, confirmed)) < 0.02
        && ["STOP", "HOLD"].includes(commandedGate());
    setText("gateConfirmNote", match
        ? "Physical position confirmed by telemetry."
        : "Command sent – physical position updates when the device reports it.");
}

function renderLogs(entries) {
    const body = document.getElementById("logBody");
    if (!body) return;
    if (!entries.length) {
        body.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No administrative commands yet.</td></tr>`;
        return;
    }
    body.innerHTML = entries.slice().reverse().map((row) => `
        <tr>
            <td>${formatTimestamp(row.timestamp)}</td>
            <td><code>${row.command || "—"}</code></td>
            <td>${row.target || "—"}</td>
            <td>${row.previousState || "—"}</td>
            <td>${row.newState || "—"}</td>
            <td><span class="status-pill pill-on">${row.status || "SENT"}</span></td>
        </tr>
    `).join("");
}

function bindButtons() {
    document.getElementById("pumpOn")?.addEventListener("click", () => sendPump("ON"));
    document.getElementById("pumpOff")?.addEventListener("click", () => sendPump("OFF"));
    document.getElementById("solenoidOpen")?.addEventListener("click", () => sendSolenoid("OPEN"));
    document.getElementById("solenoidClose")?.addEventListener("click", () => sendSolenoid("CLOSED"));
    document.getElementById("gateOpenFull")?.addEventListener("click", () => sendGate("OPEN_FULL"));
    document.getElementById("gateStop")?.addEventListener("click", () => sendGate("STOP"));
    document.getElementById("gateCloseFull")?.addEventListener("click", () => sendGate("CLOSE_FULL"));
    document.getElementById("gateStepOpen")?.addEventListener("click", () => sendGate("STEP_OPEN"));
    document.getElementById("gateStepClose")?.addEventListener("click", () => sendGate("STEP_CLOSE"));
}

function subscribe() {
    onValue(ref(db, PATHS.connected), (snap) => {
        state.firebaseConnected = snap.val() === true;
        updateAdminUi();
    }, (error) => {
        console.error("Firebase connection listener failed:", error);
        state.firebaseConnected = false;
        updateAdminUi();
    });

    onValue(ref(db, PATHS.device), (snap) => {
        state.device = snap.val();
        updateAdminUi();
    }, (error) => console.error("device listener failed:", error));

    onValue(ref(db, PATHS.telemetryCurrent), (snap) => {
        state.telemetry = snap.val();
        updateAdminUi();
    }, (error) => console.error("telemetry/current listener failed:", error));

    onValue(ref(db, PATHS.controls), (snap) => {
        state.controls = snap.val();
        updateAdminUi();
    }, (error) => console.error("controls listener failed:", error));

    const logsQuery = query(ref(db, PATHS.logs), orderByKey(), limitToLast(50));
    onValue(logsQuery, (snap) => {
        const value = snap.val() || {};
        const entries = Object.values(value).sort((a, b) => toNumber(a.timestamp) - toNumber(b.timestamp));
        renderLogs(entries);
    }, (error) => console.error("logs listener failed:", error));
}

async function init() {
    bindButtons();
    try {
        await ensureDefaults();
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }
    subscribe();
}

document.addEventListener("DOMContentLoaded", init);
