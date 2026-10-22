/**
 * NeerNilai – Scenarios & Scenario Director Engine
 * Simulates physical real-world stress conditions and hazards on the reservoir.
 * 
 * Scenarios:
 * 1. MONSOON_SURGE: Heavy catchment rainfall driving massive rapid inflow (12+ L/min), challenging sluice gate outflow.
 * 2. DROUGHT: Prolonged dry period, near-zero inflow, low storage, requiring water conservation.
 * 3. PUMP_FAILURE: Inflow pump stalls unexpectedly; intake drops to zero despite pump being commanded ON.
 * 4. GATE_JAM: Sluice gate motor stalls / binds mechanically at 15% open; cannot vent surge water.
 * 5. SENSOR_FAULT: Ultrasonic water level sensor suffers electrical fault (high noise, NaN, jump spikes).
 * 6. WIFI_DROP: Connectivity lost to ESP32 for 20 seconds, verifying offline autonomous firmware safety.
 * 7. FLASH_FLOOD: Extreme sudden surge exceeding normal emergency spillway thresholds.
 */

export const SCENARIO_DEFS = {
    NORMAL: {
        id: "NORMAL",
        name: "Standard Operation",
        nameTa: "வழக்கமான செயல்பாடு",
        description: "Normal diurnal inflow and controlled outflow with no hardware or environmental faults.",
        durationSec: 0,
        badgeClass: "badge-normal",
        icon: "bi-check-circle"
    },
    MONSOON_SURGE: {
        id: "MONSOON_SURGE",
        name: "Monsoon Surge",
        nameTa: "பருவமழை வெள்ளப்பெருக்கு",
        description: "Intense rainfall causes surge inflow (8–13 L/min). Water rises rapidly towards critical threshold.",
        durationSec: 90,
        badgeClass: "badge-warning",
        icon: "bi-cloud-rain-heavy-fill"
    },
    DROUGHT: {
        id: "DROUGHT",
        name: "Drought & Water Stress",
        nameTa: "வறட்சி நிலை",
        description: "Severe drought drops inflow below 0.1 L/min. Storage depletes to low water advisory zone.",
        durationSec: 75,
        badgeClass: "badge-low",
        icon: "bi-sun-fill"
    },
    PUMP_FAILURE: {
        id: "PUMP_FAILURE",
        name: "Inflow Pump Hardware Fault",
        nameTa: "பம்பு பழுது",
        description: "Pump commanded ON but diaphragm mechanically seizes. Inflow immediately drops to 0.",
        durationSec: 45,
        badgeClass: "badge-critical",
        icon: "bi-exclamation-octagon-fill"
    },
    GATE_JAM: {
        id: "GATE_JAM",
        name: "Sluice Gate Mechanical Jam",
        nameTa: "மதகு நெரிசல் பழுது",
        description: "Gate sticks at 15% open. Actuator reports jam alarm, limiting overflow release capability.",
        durationSec: 60,
        badgeClass: "badge-critical",
        icon: "bi-gear-wide-connected"
    },
    SENSOR_FAULT: {
        id: "SENSOR_FAULT",
        name: "Ultrasonic Sensor Jitter & Fault",
        nameTa: "சென்சார் பிழை",
        description: "Transducer acoustic bounce errors produce random NaN dropouts and spike readings.",
        durationSec: 40,
        badgeClass: "badge-warning",
        icon: "bi-reception-1"
    },
    WIFI_DROP: {
        id: "WIFI_DROP",
        name: "Field Telemetry Link Drop",
        nameTa: "இணைய இணைப்பு துண்டிப்பு",
        description: "Wi-Fi link to dashboard goes dark for 25s. ESP32 firmware brain manages overflow locally.",
        durationSec: 30,
        badgeClass: "badge-critical",
        icon: "bi-wifi-off"
    },
    FLASH_FLOOD: {
        id: "FLASH_FLOOD",
        name: "Emergency Flash Flood",
        nameTa: "திடீர் பெருவெள்ளம்",
        description: "Catastrophic cloudburst upstream forces water level above 80% to test emergency auto-open.",
        durationSec: 90,
        badgeClass: "badge-critical",
        icon: "bi-tsunami"
    }
};

class ScenarioDirector {
    constructor() {
        this.activeScenario = "NORMAL";
        this.elapsedSec = 0;
        this.listeners = [];
        this.override = null;
    }

    onScenarioChange(callback) {
        this.listeners.push(callback);
        callback(this.getActiveDef(), this.elapsedSec);
    }

    notify() {
        const def = this.getActiveDef();
        this.listeners.forEach((cb) => cb(def, this.elapsedSec));
    }

    getActiveDef() {
        return SCENARIO_DEFS[this.activeScenario] || SCENARIO_DEFS.NORMAL;
    }

    setScenario(scenarioId) {
        if (!SCENARIO_DEFS[scenarioId]) {
            console.warn(`Unknown scenario ID: ${scenarioId}`);
            return;
        }
        this.activeScenario = scenarioId;
        this.elapsedSec = 0;
        console.log(`[ScenarioDirector] Activated: ${scenarioId}`);
        this.notify();
    }

    tick(dtSeconds) {
        if (this.activeScenario === "NORMAL") return;
        this.elapsedSec += dtSeconds;
        const def = this.getActiveDef();
        if (def.durationSec > 0 && this.elapsedSec >= def.durationSec) {
            console.log(`[ScenarioDirector] Scenario ${this.activeScenario} completed. Returning to NORMAL.`);
            this.setScenario("NORMAL");
        } else {
            this.notify();
        }
    }

    /**
     * Compute physical modifications based on active scenario.
     * @param {Object} currentPhysics { inflow, outflow, waterLevel, gateActual, pump, solenoid, settings }
     * @returns {Object} { inflowMod, outflowMod, gateAllowedMax, sensorNoise, wifiSuppressed, jamAlarm }
     */
    evaluatePhysicsMods(currentPhysics) {
        const s = this.activeScenario;
        const t = this.elapsedSec;

        let inflowOverride = null;
        let outflowMultiplier = 1;
        let gateMaxOpening = 1.0;
        let sensorNoise = 0;
        let sensorDropOut = false;
        let wifiSuppressed = false;
        let gateJammed = false;
        let pumpStalled = false;

        switch (s) {
            case "MONSOON_SURGE":
                // Inflow ramps up violently from base up to 12.5 L/min
                const surgeCurve = Math.min(1, t / 15);
                inflowOverride = 4.0 + (8.5 * surgeCurve) + Math.sin(t / 3) * 1.2;
                break;

            case "DROUGHT":
                // Inflow drops to a trickle
                inflowOverride = Math.max(0.05, 0.4 - (t / 100));
                break;

            case "PUMP_FAILURE":
                pumpStalled = true;
                inflowOverride = 0.0;
                break;

            case "GATE_JAM":
                // Gate cannot open past 15% (0.15 rot)
                gateMaxOpening = 0.15;
                gateJammed = true;
                break;

            case "SENSOR_FAULT":
                // Ultrasonic returns noise spikes or NaN
                if (Math.random() < 0.25) {
                    sensorDropOut = true;
                } else {
                    sensorNoise = (Math.random() - 0.5) * 2.8; // High jitter
                }
                break;

            case "WIFI_DROP":
                // Suppress cloud writes for duration
                if (t >= 3 && t <= 25) {
                    wifiSuppressed = true;
                }
                break;

            case "FLASH_FLOOD":
                // Massive flood inflow forcing immediate emergency gate dispatch
                inflowOverride = 13.5 + Math.sin(t / 2) * 1.5;
                break;

            default:
                break;
        }

        return {
            inflowOverride,
            outflowMultiplier,
            gateMaxOpening,
            sensorNoise,
            sensorDropOut,
            wifiSuppressed,
            gateJammed,
            pumpStalled
        };
    }
}

export const scenarioDirector = new ScenarioDirector();
